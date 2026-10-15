import type { Sandbox } from "@daytona/sdk"
import { tool } from "ai"
import { z } from "zod"

import { daytona, startDesktop } from "@/lib/daytona/client"
import { db } from "@/lib/db/client"

const HOME = "/home/daytona"
// Keep long command output and files from flooding the model's context
const MAX_CHARS = 20_000

function truncate(text: string) {
  return text.length > MAX_CHARS
    ? `${text.slice(0, MAX_CHARS)}\n… (truncated, ${text.length - MAX_CHARS} more characters)`
    : text
}

// The sandbox of the bot in this chat, started if it was stopped while idle
async function connect(chatId: string) {
  const member = await db.query.chatMembers.findFirst({
    where: (m, { eq }) => eq(m.chatId, chatId),
    with: { bot: { columns: { sandboxId: true } } },
  })
  if (!member) throw new Error(`No bot in chat ${chatId}`)

  const sandbox = await daytona.get(member.bot.sandboxId)
  if (sandbox.state !== "started") await sandbox.start()
  return sandbox
}

async function captureScreen(sandbox: Sandbox) {
  await startDesktop(sandbox)
  const [shot, display] = await Promise.all([
    sandbox.computerUse.screenshot.takeCompressed({
      format: "jpeg",
      quality: 70,
      showCursor: true,
    }),
    sandbox.computerUse.display.getInfo(),
  ])
  if (!shot.screenshot) throw new Error("The screenshot came back empty.")
  // Daytona's desktop has a single 1024x768 display unless set at creation
  const screen = display.displays?.[0]
  return {
    data: shot.screenshot,
    mediaType: "image/jpeg",
    width: screen?.width ?? 1024,
    height: screen?.height ?? 768,
  }
}

type Screen = Awaited<ReturnType<typeof captureScreen>>

// The model sees the screenshot as an image, not a wall of base64
function screenToModel({ output }: { output: Screen }) {
  return {
    type: "content" as const,
    value: [
      {
        type: "text" as const,
        text: `Screenshot of the ${output.width}x${output.height} screen.`,
      },
      {
        type: "file" as const,
        mediaType: output.mediaType,
        data: { type: "data" as const, data: output.data },
      },
    ],
  }
}

const point = {
  x: z.number().int().min(0).describe("Pixels from the left of the screen"),
  y: z.number().int().min(0).describe("Pixels from the top of the screen"),
}

// Tools that drive the bot's sandbox. The sandbox is looked up on the first
// tool call, so turns that use no tools never touch Daytona
export function computerTools(chatId: string) {
  let pending: Promise<Sandbox> | undefined
  const sandbox = () => {
    pending ??= connect(chatId).catch((error) => {
      pending = undefined // Let the next call try again
      throw error
    })
    return pending
  }
  const desktop = async () => {
    const box = await sandbox()
    await startDesktop(box)
    return box.computerUse
  }

  return {
    bash: tool({
      description: `Run a shell command in your sandbox with bash. Each call is a fresh shell starting in ${HOME}; chain steps with && or cd inside the command. Start long-running or GUI programs in the background (nohup ... &) so the call returns.`,
      inputSchema: z.object({
        command: z.string().describe("The command to run"),
        timeout: z
          .number()
          .int()
          .min(1)
          .max(600)
          .optional()
          .describe("Seconds to wait before giving up. Defaults to 60"),
      }),
      execute: async ({ command, timeout = 60 }) => {
        const box = await sandbox()
        // DISPLAY lets GUI programs open on the desktop
        const response = await box.process.executeCommand(
          command,
          HOME,
          { DISPLAY: ":0" },
          timeout
        )
        return {
          exitCode: response.exitCode ?? 0,
          output: truncate(response.result),
        }
      },
    }),

    readFile: tool({
      description: "Read a text file from your sandbox.",
      inputSchema: z.object({
        path: z.string().describe(`Absolute, or relative to ${HOME}`),
      }),
      execute: async ({ path }) => {
        const box = await sandbox()
        const content = await box.fs.downloadFile(path)
        return { content: truncate(content.toString("utf8")) }
      },
    }),

    writeFile: tool({
      description:
        "Create or overwrite a text file in your sandbox with the given content.",
      inputSchema: z.object({
        path: z.string().describe(`Absolute, or relative to ${HOME}`),
        content: z.string().describe("The whole new content of the file"),
      }),
      execute: async ({ path, content }) => {
        const box = await sandbox()
        await box.fs.uploadFile(Buffer.from(content, "utf8"), path)
        return { bytes: Buffer.byteLength(content, "utf8") }
      },
    }),

    listFiles: tool({
      description: "List the files and folders in a directory of your sandbox.",
      inputSchema: z.object({
        path: z
          .string()
          .default(HOME)
          .describe(`Absolute, or relative to ${HOME}`),
      }),
      execute: async ({ path }) => {
        const box = await sandbox()
        const files = await box.fs.listFiles(path)
        return {
          files: files.map((file) => ({
            name: file.name,
            isDir: file.isDir,
            size: file.size,
            modifiedAt: file.modTime,
          })),
        }
      },
    }),

    mouseClick: tool({
      description: "Click the mouse at a point on the screen.",
      inputSchema: z.object({
        ...point,
        button: z.enum(["left", "right", "middle"]).default("left"),
        double: z.boolean().default(false).describe("Double-click"),
      }),
      execute: async ({ x, y, button, double }) => {
        const computer = await desktop()
        await computer.mouse.click(x, y, button, double)
        return { x, y }
      },
    }),

    mouseMove: tool({
      description: "Move the mouse to a point on the screen without clicking.",
      inputSchema: z.object(point),
      execute: async ({ x, y }) => {
        const computer = await desktop()
        const position = await computer.mouse.move(x, y)
        return { x: position.x, y: position.y }
      },
    }),

    mouseDrag: tool({
      description:
        "Press the left button at one point, drag to another, and release.",
      inputSchema: z.object({
        startX: point.x,
        startY: point.y,
        endX: point.x,
        endY: point.y,
      }),
      execute: async ({ startX, startY, endX, endY }) => {
        const computer = await desktop()
        const position = await computer.mouse.drag(startX, startY, endX, endY)
        return { x: position.x, y: position.y }
      },
    }),

    mouseScroll: tool({
      description: "Scroll the mouse wheel over a point on the screen.",
      inputSchema: z.object({
        ...point,
        direction: z.enum(["up", "down"]),
        amount: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(3)
          .describe("Wheel notches, each a few lines"),
      }),
      execute: async ({ x, y, direction, amount }) => {
        const computer = await desktop()
        await computer.mouse.scroll(x, y, direction, amount)
        return { x, y }
      },
    }),

    keyboardType: tool({
      description:
        "Type text into whatever has keyboard focus. Newlines press Enter.",
      inputSchema: z.object({ text: z.string() }),
      execute: async ({ text }) => {
        const computer = await desktop()
        await computer.keyboard.type(text)
        return { characters: text.length }
      },
    }),

    keyboardPress: tool({
      description:
        "Press one key, optionally while holding modifiers, like enter, escape, tab, backspace, up, f5, or c with ctrl.",
      inputSchema: z.object({
        key: z.string().describe("A key name, letter, or digit"),
        modifiers: z.array(z.enum(["ctrl", "alt", "shift", "cmd"])).default([]),
      }),
      execute: async ({ key, modifiers }) => {
        const computer = await desktop()
        await computer.keyboard.press(key, modifiers)
        return { key, modifiers }
      },
    }),

    viewScreen: tool({
      description:
        "Take a screenshot so you can see the screen yourself, for example to find where to click or to check what an action did. The person does not see it. Use showScreen instead when they ask to see the screen.",
      inputSchema: z.object({}),
      execute: async () => captureScreen(await sandbox()),
      toModelOutput: screenToModel,
    }),

    showScreen: tool({
      description:
        "Take a screenshot and show it to the person in the chat. Use it when they ask what's on the screen or want to see it.",
      inputSchema: z.object({}),
      execute: async () => captureScreen(await sandbox()),
      toModelOutput: screenToModel,
    }),
  }
}

export type ComputerTools = ReturnType<typeof computerTools>
