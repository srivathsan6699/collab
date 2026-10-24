"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { UserButton } from "@clerk/nextjs"
import { PlusIcon, UsersIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatPreview } from "@/components/chat-preview"
import { ChatSearch } from "@/components/chat-search"
import { GroupChatDialog } from "@/components/group-chat-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useUpgrade } from "@/components/upgrade-toast"
import { BOT_FEATURES } from "@/lib/billing"
import type { BotListItem, ChatListItem } from "@/queries/bot"

export function AppSidebar({
  chats,
  bots,
}: {
  chats: ChatListItem[]
  bots: BotListItem[]
}) {
  const [botDialogOpen, setBotDialogOpen] = React.useState(false)
  const [groupChatDialogOpen, setGroupChatDialogOpen] = React.useState(false)
  const pathname = usePathname()
  const { requireFeatures } = useUpgrade()
  const contentRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    contentRef.current
      ?.querySelector("[data-active]")
      ?.scrollIntoView({ block: "nearest" })
  }, [pathname])

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="ghost" size="icon" aria-label="New" />}
            >
              <PlusIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto">
              <DropdownMenuItem
                onClick={() => {
                  if (requireFeatures(BOT_FEATURES, "Can't create bot"))
                    setBotDialogOpen(true)
                }}
              >
                <PlusIcon />
                Create new bot
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setGroupChatDialogOpen(true)}>
                <UsersIcon />
                Create group chat
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ChatSearch chats={chats} />
        <BotDialog open={botDialogOpen} onOpenChange={setBotDialogOpen} />
        <GroupChatDialog
          bots={bots}
          open={groupChatDialogOpen}
          onOpenChange={setGroupChatDialogOpen}
        />
      </SidebarHeader>
      <SidebarContent ref={contentRef}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <SidebarMenuButton
                    size="lg"
                    className="h-auto gap-3 group-data-[collapsible=icon]:p-1!"
                    tooltip={chat.name}
                    isActive={pathname === `/chats/${chat.id}`}
                    render={<Link href={`/chats/${chat.id}`} />}
                  >
                    <ChatPreview chat={chat} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={({ className }) => (
                <UserButton
                  showName
                  appearance={{
                    elements: {
                      rootBox: "flex w-full",
                      userButtonTrigger: className,
                      userButtonBox:
                        "min-w-0 flex-row-reverse justify-end gap-2",
                      userButtonAvatarBox: "size-8 rounded-lg",
                      userButtonOuterIdentifier:
                        "truncate ps-0 text-sm font-medium text-inherit",
                    },
                  }}
                />
              )}
            />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
