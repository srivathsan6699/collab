"use server"

import { auth } from "@clerk/nextjs/server"
import * as Sentry from "@sentry/nextjs"
import { revalidatePath } from "next/cache"
import { and, eq, inArray, notInArray } from "drizzle-orm"
import { z } from "zod"

import { db } from "@/lib/db"
import {
  bots,
  chatMembers,
  chats,
  insertGroupChatSchema,
  updateGroupChatSchema,
  type InsertGroupChat,
  type UpdateGroupChat,
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

  Sentry.logger.info("Group chat created", {
    chatId: chat.id,
    userId,
    botCount: unique.length,
  })
  revalidatePath("/", "layout")
  return { ok: true, id: chat.id }
}

type UpdateGroupChatResult =
  | { ok: true }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof UpdateGroupChat, string[]>>
    }

export async function updateGroupChat(
  chatId: string,
  input: UpdateGroupChat
): Promise<UpdateGroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }

  const parsed = updateGroupChatSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const { name, botIds } = parsed.data
  const unique = [...new Set(botIds)]

  const result = await db.transaction(async (tx) => {
    // The bot ids come from the browser, so only the user's own bots join
    const owned = await tx
      .select({ id: bots.id })
      .from(bots)
      .where(and(inArray(bots.id, unique), eq(bots.userId, userId)))
    if (owned.length !== unique.length) return "bots"

    const [chat] = await tx
      .update(chats)
      .set({ name })
      .where(
        and(
          eq(chats.id, chatId),
          eq(chats.userId, userId),
          eq(chats.kind, "group")
        )
      )
      .returning({ id: chats.id })
    if (!chat) return "missing"

    // Bots that stay keep their join order; only the difference changes
    await tx
      .delete(chatMembers)
      .where(
        and(
          eq(chatMembers.chatId, chatId),
          notInArray(chatMembers.botId, unique)
        )
      )
    await tx
      .insert(chatMembers)
      .values(unique.map((botId) => ({ chatId, botId })))
      .onConflictDoNothing()
    return "ok"
  })
  if (result === "missing")
    return { ok: false, error: "That group chat no longer exists." }
  if (result === "bots")
    return { ok: false, error: "Some of those bots no longer exist." }

  Sentry.logger.info("Group chat updated", {
    chatId,
    userId,
    botCount: unique.length,
  })
  // The name and faces show in the sidebar and the chat's header
  revalidatePath("/", "layout")
  return { ok: true }
}

type DeleteGroupChatResult = { ok: true } | { ok: false; error: string }

export async function deleteGroupChat(
  chatId: string
): Promise<DeleteGroupChatResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }

  // Deleting the chat cascades its memberships; the bots stay
  const [chat] = await db
    .delete(chats)
    .where(
      and(
        eq(chats.id, chatId),
        eq(chats.userId, userId),
        eq(chats.kind, "group")
      )
    )
    .returning({ id: chats.id })
  if (!chat) return { ok: false, error: "That group chat no longer exists." }

  Sentry.logger.info("Group chat deleted", { chatId, userId })
  revalidatePath("/", "layout")
  return { ok: true }
}
