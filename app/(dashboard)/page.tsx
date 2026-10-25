import type { Metadata } from "next"
import { auth } from "@clerk/nextjs/server"
import { PlusIcon } from "lucide-react"

import { BotDialog } from "@/components/bot-dialog"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

export const metadata: Metadata = { title: "Chats" }

export default async function Page() {
  await auth.protect()

  return (
    <div className="flex min-h-svh">
      <Empty>
        <EmptyHeader>
          <EmptyMedia>
            <ChatAvatar seed={crypto.randomUUID()} className="size-10" />
          </EmptyMedia>
          <EmptyTitle>Meet your first bot</EmptyTitle>
          <EmptyDescription>
            Not just another chatbot. Yours has a face, a past and a point of
            view.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <BotDialog
            trigger={
              <Button variant="secondary">
                <PlusIcon data-icon="inline-start" />
                Bring one to life
              </Button>
            }
          />
        </EmptyContent>
      </Empty>
    </div>
  )
}
