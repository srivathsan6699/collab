import "server-only"

import { auth } from "@clerk/nextjs/server"

import { db } from "@/lib/db"

export type Chat = {
  id: string
  name: string
  avatar: string
  bot: {
    id: string
    name: string
    avatar: string
    job: string
    instructions: string | null
  }
}

// One of the signed-in user's chats, or null if it doesn't exist or belongs to
// someone else. Group chats show their first bot until they get their own
// treatment.
export async function getChat(chatId: string): Promise<Chat | null> {
  const { userId } = await auth.protect()

  const chat = await db.query.chats.findFirst({
    where: (chats, { and, eq }) =>
      and(eq(chats.id, chatId), eq(chats.userId, userId)),
    columns: { id: true, name: true },
    with: {
      members: {
        orderBy: (members, { asc }) => asc(members.joinedAt),
        limit: 1,
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

  const bot = chat?.members[0]?.bot
  if (!chat || !bot) return null

  return {
    id: chat.id,
    name: chat.name ?? bot.name,
    avatar: bot.avatar,
    bot,
  }
}
