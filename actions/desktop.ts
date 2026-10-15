"use server"

import { daytona, startDesktop } from "@/lib/daytona"
import { db } from "@/lib/db"
import { getChat } from "@/queries/chat"

// noVNC's web client in Daytona's default image
const VNC_PORT = 6080

type GetDesktopUrlResult =
  { ok: true; url: string } | { ok: false; error: string }

// A signed noVNC link to the desktop of the bot in this chat, starting its
// sandbox and desktop first if they were stopped
export async function getDesktopUrl(
  chatId: string
): Promise<GetDesktopUrlResult> {
  // getChat checks the signed-in user owns the chat
  const chat = await getChat(chatId)
  if (!chat) return { ok: false, error: "That chat no longer exists." }

  const bot = await db.query.bots.findFirst({
    where: (bots, { eq }) => eq(bots.id, chat.bot.id),
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
