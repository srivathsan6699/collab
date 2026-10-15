import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { DesktopPanelTrigger } from "@/components/desktop-panel"
import { Button } from "@/components/ui/button"
import type { Chat } from "@/queries/chat"

function ChatHeader({ chat }: { chat: Chat }) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <h1 className="min-w-0 flex-1">
        <BotDialog
          bot={chat.bot}
          trigger={
            <Button variant="ghost" size="sm" className="max-w-full">
              <ChatAvatar seed={chat.avatar} className="size-5" />
              <span className="truncate">{chat.name}</span>
            </Button>
          }
        />
      </h1>
      <DesktopPanelTrigger />
    </header>
  )
}

export { ChatHeader }
