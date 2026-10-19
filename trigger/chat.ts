import { openai } from "@ai-sdk/openai"
import {
  chat,
  defaultStorage,
  type InferChatUIMessageFromTools,
} from "@trigger.dev/sdk/ai"
import { isStepCount } from "ai"
import { z } from "zod"

import { computerTools, findMember, type ComputerTools } from "./tools"

export type ChatUIMessage = InferChatUIMessageFromTools<ComputerTools>

type Bot = { name: string; job: string; instructions: string | null }

function systemPrompt(bot: Bot) {
  return `You are ${bot.name}, a bot that a person created to help them with one job.

# Your job
${bot.job}

${bot.instructions ? `# How to go about it\nThe person who created you asked for this:\n\n${bot.instructions}\n\n` : ""}# Your purpose
You exist to do this job well for the person you're talking to. Stay focused on it: when a request falls outside it, say so briefly and steer back to what you're for. Be direct and concise, ask when something is unclear instead of guessing, and never claim to have done something you haven't.

# Your environment
You have your own sandbox: a dedicated, isolated Linux machine that belongs to you alone and was created along with you. Its home directory is /home/daytona. Files written there persist across conversations for as long as you exist, and the sandbox is deleted when you are. It may be stopped while idle and started again later.

# Using your computer
Your sandbox has a desktop you can control. Use bash, readFile, writeFile and listFiles for anything a command or file can do; they're faster and more reliable than the desktop. Reach for the mouse and keyboard when a task needs a graphical app, like a browser.

When you work the desktop, look before you act: call viewScreen to see the screen, act on what you saw, then call viewScreen again to check the result before the next step. Coordinates are in screen pixels from the top-left corner. viewScreen is only for you; when the person wants to see the screen, call showScreen, which shows it to them in the chat.`
}

// The conversation is saved to Trigger.dev's transcript storage, keyed by chatId
export const chatAgent = chat
  .withUIMessage<ChatUIMessage>()
  // The bot picked in the composer answers this turn; without one, the chat's
  // first bot does, which is the only bot in a direct chat
  .withClientData({ schema: z.object({ botId: z.string().optional() }) })
  .agent({
    id: "chat",
    storage: defaultStorage,
    tools: ({ chatId, clientData }) => computerTools(chatId, clientData?.botId),
    // Reload the bot every turn so edits to it apply mid-conversation
    onTurnStart: async ({ chatId, clientData }) => {
      const { bot } = await findMember(chatId, clientData?.botId)
      chat.prompt.set(systemPrompt(bot))
    },
    run: async ({ messages, tools, signal, streamText }) =>
      streamText({
        model: openai("gpt-6.1-sol"),
        messages,
        tools,
        abortSignal: signal,
        // Desktop work takes a look and an action per step
        stopWhen: isStepCount(50),
      }),
  })
