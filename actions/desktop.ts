"use server"

import { auth } from "@clerk/nextjs/server"

import {
  SANDBOX_FEATURES,
  SANDBOX_LIMIT_MESSAGE,
  UPGRADE_REQUIRED,
  USAGE_LIMIT_REACHED,
} from "@/lib/billing"
import { daytona, startDesktop } from "@/lib/daytona"
import { db } from "@/lib/db"
import { getUsage, sandboxRemainingSeconds } from "@/lib/usage"
import { getChat } from "@/queries/chat"

// noVNC's web client in Daytona's default image
const VNC_PORT = 6080

type GetDesktopUrlResult =
  | { ok: true; url: string }
  | {
      ok: false
      error: string
      code?: typeof UPGRADE_REQUIRED | typeof USAGE_LIMIT_REACHED
    }

// A signed noVNC link to the desktop of the bot in this chat, starting its
// sandbox and desktop first if they were stopped
export async function getDesktopUrl(
  chatId: string
): Promise<GetDesktopUrlResult> {
  const { has, userId } = await auth()
  if (!userId || !SANDBOX_FEATURES.every((feature) => has({ feature })))
    return {
      ok: false,
      error: "The desktop needs the Pro plan.",
      code: UPGRADE_REQUIRED,
    }
  // Opening the desktop starts the sandbox, on this period's sandbox time
  if (sandboxRemainingSeconds(await getUsage(userId)) <= 0)
    return {
      ok: false,
      error: SANDBOX_LIMIT_MESSAGE,
      code: USAGE_LIMIT_REACHED,
    }

  // getChat checks the signed-in user owns the chat
  const chat = await getChat(chatId)
  if (!chat) return { ok: false, error: "That chat no longer exists." }
  // Group chats have several bots, so there's no one desktop to show
  if (chat.kind !== "direct")
    return { ok: false, error: "Group chats don't have a desktop." }

  const bot = await db.query.bots.findFirst({
    where: (bots, { eq }) => eq(bots.id, chat.bots[0].id),
    columns: { sandboxId: true },
  })
  if (!bot) return { ok: false, error: "That bot no longer exists." }

  try {
    const sandbox = await daytona.get(bot.sandboxId)
    if (sandbox.state !== "started") await sandbox.start()
    await startDesktop(sandbox)
    const { url } = await sandbox.getSignedPreviewUrl(VNC_PORT, 3600)
    const vnc = new URL("/vnc.html", url)
    vnc.search = "autoconnect=true&reconnect=true&resize=scale"
    return { ok: true, url: vnc.toString() }
  } catch (error) {
    console.error(
      `Failed to open the desktop of sandbox ${bot.sandboxId}`,
      error
    )
    return { ok: false, error: "Couldn't reach the desktop. Try again." }
  }
}
