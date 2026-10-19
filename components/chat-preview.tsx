import { formatDistanceToNowStrict } from "date-fns"

import { GroupChatAvatar } from "@/components/group-chat-avatar"
import type { ChatListItem } from "@/queries/bot"

function ChatPreview({ chat }: { chat: ChatListItem }) {
  return (
    <>
      <GroupChatAvatar
        seeds={chat.avatars}
        className="size-10 group-data-[collapsible=icon]:size-6"
      />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{chat.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatDistanceToNowStrict(chat.lastMessageAt)}
          </span>
        </div>
        <span className="truncate text-muted-foreground">
          {chat.lastMessagePreview}
        </span>
      </div>
    </>
  )
}

export { ChatPreview }
