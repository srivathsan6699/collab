import "server-only"

import { auth } from "@clerk/nextjs/server"

import { db } from "@/lib/db"

export type ChatListItem = {
  id: string
  name: string
  // Faces of the chat's bots, in the order they joined
  avatars: string[]
  lastMessagePreview: string | null
  lastMessageAt: Date
}

// The signed-in user's chats, most recent first
export async function getChats(): Promise<ChatListItem[]> {
  const { userId } = await auth.protect()

  const rows = await db.query.chats.findMany({
    where: (chats, { eq }) => eq(chats.userId, userId),
    orderBy: (chats, { desc }) => desc(chats.lastMessageAt),
    columns: {
      id: true,
      name: true,
      lastMessagePreview: true,
      lastMessageAt: true,
    },
    with: {
      members: {
        orderBy: (members, { asc }) => asc(members.joinedAt),
        with: { bot: { columns: { name: true, avatar: true } } },
      },
    },
  })

  return rows.flatMap(({ members, ...chat }) => {
    const bot = members[0]?.bot
    if (!bot) return []
    return [
      {
        ...chat,
        name: chat.name ?? bot.name,
        avatars: members.map((member) => member.bot.avatar),
      },
    ]
  })
}

export type BotListItem = { id: string; name: string; avatar: string }

// The signed-in user's bots, oldest first, for picking group chat members
export async function getBots(): Promise<BotListItem[]> {
  const { userId } = await auth.protect()

  return db.query.bots.findMany({
    where: (bots, { eq }) => eq(bots.userId, userId),
    orderBy: (bots, { asc }) => asc(bots.createdAt),
    columns: { id: true, name: true, avatar: true },
  })
}
