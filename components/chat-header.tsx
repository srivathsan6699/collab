import { BotDialog } from "@/components/bot-dialog"
import { DesktopPanelTrigger } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { Button } from "@/components/ui/button"
import type { Chat } from "@/queries/chat"

function ChatHeader({ chat }: { chat: Chat }) {
  const title = (
    <>
      <GroupChatAvatar
        seeds={chat.bots.map((bot) => bot.avatar)}
        className="size-5"
      />
      <span className="truncate">{chat.name}</span>
    </>
  )

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <h1 className="min-w-0 flex-1">
        {chat.kind === "direct" ? (
          <BotDialog
            bot={chat.bots[0]}
            trigger={
              <Button variant="ghost" size="sm" className="max-w-full">
                {title}
              </Button>
            }
          />
        ) : (
          // Laid out like the button so the title doesn't shift between kinds
          <div className="flex h-7 max-w-full items-center gap-1 px-2.5 text-[0.8rem] font-medium">
            {title}
          </div>
        )}
      </h1>
      {chat.kind === "direct" && <DesktopPanelTrigger />}
    </header>
  )
}

export { ChatHeader }
