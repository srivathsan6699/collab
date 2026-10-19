import { Daytona, type Sandbox } from "@daytona/sdk"

// Next.js and `trigger dev` both load .env.local into process.env. The SDK
// refuses to pick an endpoint that is set in both places, so pass ours
// explicitly. No server-only guard, so Trigger.dev tasks can use it too.
// Next.js code imports @/lib/daytona, which keeps the guard
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})

// The bot's memory: a Markdown file it reads and writes to remember things
// across all the chats it's in. Created empty with the sandbox
export const MEMORY_PATH = "/home/daytona/MEMORY.md"

// The desktop (Xvfb, xfce4, VNC) isn't running until something needs it
export async function startDesktop(sandbox: Sandbox) {
  const { running } = await sandbox.computerUse.getProcessStatus("xfce4")
  if (!running) await sandbox.computerUse.start()
}
