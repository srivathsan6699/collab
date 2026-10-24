"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import type { Sandbox } from "@daytona/sdk"
import { and, eq, inArray } from "drizzle-orm"
import { nanoid } from "nanoid"
import { z } from "zod"

import {
  BOT_FEATURES,
  SANDBOX_LIMIT_MESSAGE,
  UPGRADE_REQUIRED,
  USAGE_LIMIT_REACHED,
} from "@/lib/billing"
import { daytona, MEMORY_PATH } from "@/lib/daytona"
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
import { getUsage, sandboxRemainingSeconds } from "@/lib/usage"

type CreateBotResult =
  | { ok: true; id: string }
  | {
      ok: false
      error: string
      code?: typeof UPGRADE_REQUIRED | typeof USAGE_LIMIT_REACHED
      fieldErrors?: Partial<Record<keyof InsertBot, string[]>>
    }

export async function createBot(input: InsertBot): Promise<CreateBotResult> {
  const { isAuthenticated, userId, has } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }
  // A new bot comes with its own sandbox, so it needs both features
  if (!BOT_FEATURES.every((feature) => has({ feature })))
    return {
      ok: false,
      error: "Creating bots needs the Pro plan.",
      code: UPGRADE_REQUIRED,
    }
  // Its sandbox starts running right away, on this period's sandbox time
  if (sandboxRemainingSeconds(await getUsage(userId)) <= 0)
    return {
      ok: false,
      error: SANDBOX_LIMIT_MESSAGE,
      code: USAGE_LIMIT_REACHED,
    }

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const { instructions, ...values } = parsed.data
  const botId = nanoid()

  let sandbox: Sandbox
  try {
    sandbox = await daytona.create({ labels: { botId, userId } })
  } catch (error) {
    console.error("Failed to create sandbox for bot", error)
    return { ok: false, error: "Couldn't set up your bot. Try again." }
  }

  try {
    await sandbox.fs.uploadFile(Buffer.from(""), MEMORY_PATH)
  } catch (error) {
    console.error(`Failed to create memory in sandbox ${sandbox.id}`, error)
    await daytona.delete(sandbox).catch(console.error)
    return { ok: false, error: "Couldn't set up your bot. Try again." }
  }

  // node-postgres has no db.batch(), so a transaction keeps the three writes atomic
  let bot: { id: string }
  try {
    bot = await db.transaction(async (tx) => {
      const [bot] = await tx
        .insert(bots)
        .values({
          ...values,
          id: botId,
          instructions: instructions || null,
          sandboxId: sandbox.id,
          userId,
        })
        .returning({ id: bots.id })
      const [chat] = await tx
        .insert(chats)
        .values({ userId, kind: "direct" })
        .returning({ id: chats.id })
      await tx.insert(chatMembers).values({ chatId: chat.id, botId: bot.id })
      return bot
    })
  } catch (error) {
    // Don't leave a sandbox behind with no bot to own it
    await daytona.delete(sandbox).catch(console.error)
    throw error
  }

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
  { ok: true; chatIds: string[] } | { ok: false; error: string }

export async function deleteBot(botId: string): Promise<DeleteBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }

  const deleted = await db.transaction(async (tx) => {
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
      .returning({ sandboxId: bots.sandboxId })
    if (!bot) return null

    if (chatIds.length > 0)
      await tx.delete(chats).where(inArray(chats.id, chatIds))
    return { chatIds, sandboxId: bot.sandboxId }
  })
  if (!deleted) return { ok: false, error: "That bot no longer exists." }
  const { chatIds, sandboxId } = deleted

  // The bot is already gone, so a sandbox that won't delete is only logged
  try {
    await daytona.delete(await daytona.get(sandboxId))
  } catch (error) {
    console.error(`Failed to delete sandbox ${sandboxId}`, error)
  }

  revalidatePath("/", "layout")
  return { ok: true, chatIds }
}
