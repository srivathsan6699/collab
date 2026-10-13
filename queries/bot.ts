import "server-only"

import { auth } from "@clerk/nextjs/server"

import { db } from "@/lib/db"

export type ChatListItem = {
  id: string
  name: string
  avatar: string
  lastMessagePreview: string | null
  lastMessageAt: Date
}

// The signed-in user's chats, most recent first. Group chats show their
// first bot until they get their own treatment.
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
        limit: 1,
        with: { bot: { columns: { name: true, avatar: true } } },
      },
    },
  })

  return rows.flatMap(({ members, ...chat }) => {
    const bot = members[0]?.bot
    if (!bot) return []
    return [{ ...chat, name: chat.name ?? bot.name, avatar: bot.avatar }]
  })
}
