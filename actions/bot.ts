"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertBotSchema,
  type InsertBot,
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
