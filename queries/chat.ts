import "server-only"

import { auth } from "@clerk/nextjs/server"

import { db } from "@/lib/db"

export type ChatBot = {
  id: string
  name: string
  avatar: string
  job: string
  instructions: string | null
}

export type Chat = {
  id: string
  kind: "direct" | "group"
  name: string
  // In the order they joined; a direct chat has exactly one
  bots: ChatBot[]
}

// One of the signed-in user's chats, or null if it doesn't exist, belongs to
// someone else, or has no bots left
export async function getChat(chatId: string): Promise<Chat | null> {
  const { userId } = await auth.protect()

  const chat = await db.query.chats.findFirst({
    where: (chats, { and, eq }) =>
      and(eq(chats.id, chatId), eq(chats.userId, userId)),
    columns: { id: true, kind: true, name: true },
    with: {
      members: {
        orderBy: (members, { asc }) => asc(members.joinedAt),
        with: {
          bot: {
            columns: {
              id: true,
              name: true,
              avatar: true,
              job: true,
              instructions: true,
            },
          },
        },
      },
    },
  })

  const bots = chat?.members.map((member) => member.bot) ?? []
  if (!chat || bots.length === 0) return null

  return {
    id: chat.id,
    kind: chat.kind,
    name: chat.name ?? bots[0].name,
    bots,
  }
}
