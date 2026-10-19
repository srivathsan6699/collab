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
  insertGroupChatSchema,
  type InsertGroupChat,
} from "@/lib/db/schema"

type CreateGroupChatResult =
  | { ok: true; id: string }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof InsertGroupChat, string[]>>
    }

export async function createGroupChat(
  input: InsertGroupChat
): Promise<CreateGroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }

  const parsed = insertGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const { name, botIds } = parsed.data
  const unique = [...new Set(botIds)]

  const chat = await db.transaction(async (tx) => {
    // The bot ids come from the browser, so only the user's own bots join
    const owned = await tx
      .select({ id: bots.id })
      .from(bots)
      .where(and(inArray(bots.id, unique), eq(bots.userId, userId)))
    if (owned.length !== unique.length) return null

    const [chat] = await tx
      .insert(chats)
      .values({ userId, kind: "group", name })
      .returning({ id: chats.id })
    await tx
      .insert(chatMembers)
      .values(unique.map((botId) => ({ chatId: chat.id, botId })))
    return chat
  })
  if (!chat) return { ok: false, error: "Some of those bots no longer exist." }

  revalidatePath("/", "layout")
  return { ok: true, id: chat.id }
}
