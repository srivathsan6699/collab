import { notFound } from "next/navigation"

import { ChatConversation } from "@/components/chat-conversation"
import { ChatHeader } from "@/components/chat-header"
import {
  DesktopPanel,
  DesktopPanelProvider,
  DesktopPreview,
} from "@/components/desktop-panel"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { getChat } from "@/queries/chat"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  const chat = await getChat(chatId)
  if (!chat) notFound()

  return (
    <DesktopPanelProvider key={chatId} chatId={chatId}>
      <ResizablePanelGroup orientation="horizontal" className="h-svh">
        <ResizablePanel id="chat" minSize="30%">
          <div className="flex h-full flex-col overflow-hidden">
            <ChatHeader chat={chat} />
            <ChatConversation key={chatId} chatId={chatId} />
          </div>
        </ResizablePanel>
        <DesktopPanel>
          <ResizableHandle withHandle />
          <ResizablePanel id="desktop" defaultSize="40%" minSize="20%">
            <DesktopPreview name={chat.bot.name} />
          </ResizablePanel>
        </DesktopPanel>
      </ResizablePanelGroup>
    </DesktopPanelProvider>
  )
}
