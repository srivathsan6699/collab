import { tool } from "ai"
import { z } from "zod"

type Bot = { id: string; name: string; job: string }

// Lets a bot in a group chat pass the person's message to a better-suited
// bot. The turn ends on the call; the person then asks that bot from the chat
export function handoffTools(others: [Bot, ...Bot[]]) {
  const ids = others.map((bot) => bot.id) as [string, ...string[]]

  return {
    handoff: tool({
      description:
        "Hand the person's latest message to another bot in this group chat whose job fits it better. Call it instead of answering, and do nothing after it.",
      inputSchema: z.object({
        botId: z
          .enum(ids)
          .describe("The id of the bot to hand off to, from the group's list"),
        reason: z
          .string()
          .describe(
            "One short sentence, written to the person, on why that bot fits better"
          ),
      }),
      execute: async ({ botId }) => ({ botId }),
    }),
  }
}

export type HandoffTools = ReturnType<typeof handoffTools>
