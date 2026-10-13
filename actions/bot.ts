"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { and, eq, inArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertBotSchema,
  updateBotSchema,
  type InsertBot,
  type UpdateBot,
} from "@/lib/db/schema"

type CreateBotResult =
  | { ok: true; id: string }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof InsertBot, string[]>>
    }

export async function createBot(input: InsertBot): Promise<CreateBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const { instructions, ...values } = parsed.data
  // node-postgres has no db.batch(), so a transaction keeps the three writes atomic
  const bot = await db.transaction(async (tx) => {
    const [bot] = await tx
      .insert(bots)
      .values({ ...values, instructions: instructions || null, userId })
      .returning({ id: bots.id })
    const [chat] = await tx
      .insert(chats)
      .values({ userId, kind: "direct" })
      .returning({ id: chats.id })
    await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })
    return bot
  })

  revalidatePath("/")
  return { ok: true, id: bot.id }
}

type UpdateBotResult =
  | { ok: true }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof UpdateBot, string[]>>
    }

export async function updateBot(
  botId: string,
  input: UpdateBot
): Promise<UpdateBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }

  const parsed = updateBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const { instructions, ...values } = parsed.data
  const [bot] = await db
    .update(bots)
    .set({ ...values, instructions: instructions || null })
    .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
    .returning({ id: bots.id })
  if (!bot) return { ok: false, error: "That bot no longer exists." }

  // The bot's name and face show in the sidebar and every chat it's in
  revalidatePath("/", "layout")
  return { ok: true }
}

type DeleteBotResult =
  | { ok: true; chatIds: string[] }
  | { ok: false; error: string }

export async function deleteBot(botId: string): Promise<DeleteBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }

  const chatIds = await db.transaction(async (tx) => {
    // Find its direct chats first; deleting the bot cascades the memberships
    // that link them, and a direct chat without its bot is useless
    const direct = await tx
      .select({ id: chats.id })
      .from(chats)
      .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
      .where(
        and(
          eq(chatMembers.botId, botId),
          eq(chats.userId, userId),
          eq(chats.kind, "direct")
        )
      )
    const chatIds = direct.map((chat) => chat.id)

    const [bot] = await tx
      .delete(bots)
      .where(and(eq(bots.id, botId), eq(bots.userId, userId)))
      .returning({ id: bots.id })
    if (!bot) return null

    if (chatIds.length > 0)
      await tx.delete(chats).where(inArray(chats.id, chatIds))
    return chatIds
  })
  if (!chatIds) return { ok: false, error: "That bot no longer exists." }

  revalidatePath("/", "layout")
  return { ok: true, chatIds }
}
