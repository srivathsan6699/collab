import { BotDialog } from "@/components/bot-dialog"
import { DesktopPanelTrigger } from "@/components/desktop-panel"
import { GroupChatAvatar } from "@/components/group-chat-avatar"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import type { BotListItem } from "@/queries/bot"
import type { Chat } from "@/queries/chat"

function ChatHeader({ chat, bots }: { chat: Chat; bots: BotListItem[] }) {
  const title = (
    <>
      <GroupChatAvatar
        seeds={chat.bots.map((bot) => bot.avatar)}
        className="size-5"
      />
      <span className="truncate">{chat.name}</span>
    </>
  )
  const trigger = (
    <Button variant="ghost" size="sm" className="max-w-full">
      {title}
    </Button>
  )

  return (
    <header className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
      <h1 className="min-w-0 flex-1">
        {chat.kind === "direct" ? (
          <BotDialog bot={chat.bots[0]} trigger={trigger} />
        ) : (
          <GroupChatDialog
            bots={bots}
            chat={{
              id: chat.id,
              name: chat.name,
              botIds: chat.bots.map((bot) => bot.id),
            }}
            trigger={trigger}
          />
        )}
      </h1>
      {chat.kind === "direct" && <DesktopPanelTrigger />}
    </header>
  )
}

export { ChatHeader }
