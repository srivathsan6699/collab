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
import { getBots } from "@/queries/bot"
import { getChat } from "@/queries/chat"

export default async function Page(props: PageProps<"/chats/[chatId]">) {
  const { chatId } = await props.params
  const [chat, bots] = await Promise.all([getChat(chatId), getBots()])
  if (!chat) notFound()

  const conversation = (
    <div className="flex h-full flex-col overflow-hidden">
      <ChatHeader chat={chat} bots={bots} />
      <ChatConversation
        key={chatId}
        chatId={chatId}
        bots={chat.kind === "group" ? chat.bots : undefined}
      />
    </div>
  )

  // Group chats have several bots, so there's no one desktop to show
  if (chat.kind === "group") {
    return <div className="h-svh">{conversation}</div>
  }

  return (
    <DesktopPanelProvider key={chatId} chatId={chatId}>
      {/* The group's inline height: 100% beats a height class, so the
          wrapper caps it at the screen and only the messages scroll */}
      <div className="h-svh">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel id="chat" minSize="30%">
            {conversation}
          </ResizablePanel>
          <DesktopPanel>
            <ResizableHandle withHandle />
            <ResizablePanel id="desktop" defaultSize="40%" minSize="20%">
              <DesktopPreview name={chat.bots[0].name} />
            </ResizablePanel>
          </DesktopPanel>
        </ResizablePanelGroup>
      </div>
    </DesktopPanelProvider>
  )
}
