import { notFound } from "next/navigation"

import { ChatConversation } from "@/components/chat-conversation"
import { ChatHeader } from "@/components/chat-header"
import { getChat } from "@/queries/chat"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  const chat = await getChat(chatId)
  if (!chat) notFound()

  return (
    <div className="flex h-svh flex-col">
      <ChatHeader chat={chat} />
      <ChatConversation key={chatId} chatId={chatId} />
    </div>
  )
}
