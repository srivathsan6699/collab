import { openai } from "@ai-sdk/openai"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"
import {
  hasToolCall,
  isStepCount,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai"
import { z } from "zod"

import { AI_LIMIT_MESSAGE } from "@/lib/billing"
import { MEMORY_PATH } from "@/lib/daytona/client"
import { db } from "@/lib/db/client"
import {
  aiCostMicros,
  aiRemainingMicros,
  CHAT_MODEL,
  getUsage,
  recordAiUsage,
} from "@/lib/usage"
import { handoffTools, type HandoffTools } from "./handoff"
import { computerTools, type ComputerTools } from "./tools"

// Replies carry the bot that wrote them, so group chats can show its face
export type ChatMessageMetadata = { botId?: string }

// handoff is only offered in group chats
type ChatTools = ComputerTools & Partial<HandoffTools>

export type ChatUIMessage = UIMessage<
  ChatMessageMetadata,
  UIDataTypes,
  InferUITools<ChatTools>
>

type Bot = {
  id: string
  name: string
  job: string
  instructions: string | null
}

type Turn = {
  // The person who owns the chat, whose plan pays for the turn
  userId: string
  bot: Bot
  // Set in a group chat: its name, the bots other than the one answering, and
  // the bot that handed this message over, if one did
  group?: { name: string; others: Bot[]; handedOffBy?: Bot }
}

// Optional as a whole: a run started without client data falls back to the
// chat's first bot instead of failing validation
const clientDataSchema = z
  .object({
    // The bot picked in the composer
    botId: z.string().optional(),
    // The bot whose handoff the person accepted, sent with that one request
    handedOffBy: z.string().optional(),
  })
  .optional()

// The bot answering this turn: the one picked in the composer, else the
// chat's first. The ids come from the browser, so they must be members
async function loadTurn(
  chatId: string,
  { botId, handedOffBy }: NonNullable<z.infer<typeof clientDataSchema>> = {}
): Promise<Turn> {
  const row = await db.query.chats.findFirst({
    where: (chats, { eq }) => eq(chats.id, chatId),
    columns: { userId: true, kind: true, name: true },
    with: {
      members: {
        orderBy: (members, { asc }) => asc(members.joinedAt),
        with: {
          bot: {
            columns: { id: true, name: true, job: true, instructions: true },
          },
        },
      },
    },
  })
  const bots = row?.members.map((member) => member.bot) ?? []
  const bot = botId ? bots.find((bot) => bot.id === botId) : bots[0]
  if (!row || !bot) throw new Error(`No bot ${botId ?? ""} in chat ${chatId}`)

  if (row.kind !== "group") return { userId: row.userId, bot }
  return {
    userId: row.userId,
    bot,
    group: {
      name: row.name ?? "Group chat",
      others: bots.filter((other) => other.id !== bot.id),
      handedOffBy: bots.find((other) => other.id === handedOffBy),
    },
  }
}

function systemPrompt({ bot, group }: Turn) {
  return `You are ${bot.name}, a bot that a person created to help them with one job.

# Your job
${bot.job}

${bot.instructions ? `# How to go about it\nThe person who created you asked for this:\n\n${bot.instructions}\n\n` : ""}# Your purpose
You exist to do this job well for the person you're talking to. Stay focused on it: when a request falls outside it, say so briefly and steer back to what you're for. Be direct and concise, ask when something is unclear instead of guessing, and never claim to have done something you haven't.

# Your environment
You have your own sandbox: a dedicated, isolated Linux machine that belongs to you alone and was created along with you. Its home directory is /home/daytona. Files written there persist across conversations for as long as you exist, and the sandbox is deleted when you are. It may be stopped while idle and started again later.

# Your memory
You only see the conversation you're in, not your other chats. What carries over between them is your memory: ${MEMORY_PATH}, a Markdown file in your sandbox that you keep yourself. It's how something the person told you in your private chat reaches you in a group chat, and the other way around.

- Write to it when you learn something worth knowing later: facts about the person and their work, their preferences, decisions you made together, and anything they ask you to remember. Keep it to short bullets under topic headings, and update or remove an entry when it changes rather than adding a contradicting one. writeFile replaces the whole file, so read it first and write back everything you're keeping.
- Read it before you answer when the person refers to something that isn't in this conversation ("like I told you", "what did we decide?"), asks what you know or remember, or when their preferences would change your answer. If it isn't there either, say you don't remember instead of guessing.
- Don't write down secrets like passwords or keys, and don't narrate your memory: just use what's in it. If the file is missing, create it.

# Your tools
- Files and commands: bash runs a shell command; readFile, writeFile and listFiles work with files directly. Use these for anything a command or file can do; they're faster and more reliable than the desktop.
- The desktop: viewScreen takes a screenshot for you to look at; mouseClick, mouseMove, mouseDrag and mouseScroll drive the mouse; keyboardType types text and keyboardPress presses keys and shortcuts. Reach for these when a task needs a graphical app, like a browser.
- Showing your screen: showScreen puts a screenshot in the chat for the person to see.${group?.others.length && !group.handedOffBy ? "\n- Handing off: handoff passes the person's message to another bot in this group chat. See below." : ""}

When you work the desktop, look before you act: call viewScreen to see the screen, act on what you saw, then call viewScreen again to check the result before the next step. Coordinates are in screen pixels from the top-left corner. viewScreen is only for you; when the person wants to see the screen, call showScreen.${group ? groupPrompt(group) : ""}`
}

function groupPrompt(group: NonNullable<Turn["group"]>) {
  const others = group.others
    .map((bot) => `- ${bot.name} (id: ${bot.id}): ${bot.job}`)
    .join("\n")

  return `

# This group chat
You're in a group chat called "${group.name}" with the person and other bots they created. Each bot has its own job and its own sandbox. The person picks which bot answers each message, and they picked you for this one.

Earlier replies in this conversation may have been written by other bots, not you. Don't take credit for their work or claim to remember doing it. Their sandboxes are separate from yours, so you can't see their files, screens or memories; if you need something they made, ask the person for it.

What the person told you in your private chat isn't in this conversation, but it may be in your memory. When they ask about it here, read your memory before you answer.

There's no desktop panel in a group chat, so the person only sees your screen when you call showScreen.

${others ? `The other bots here:\n${others}` : "There are no other bots here right now."}${handoffPrompt(group)}`
}

function handoffPrompt(group: NonNullable<Turn["group"]>) {
  if (group.handedOffBy) {
    return `

# Handed to you
${group.handedOffBy.name} handed the person's latest message to you because it fits your job better, and the person agreed. Answer it yourself; it can't be handed off again.`
  }
  if (group.others.length === 0) return ""
  return `

# Handing off
When the person's latest message belongs clearly more to another bot's job than to yours, don't answer it. Call handoff with that bot's id and a one-sentence reason, and stop; the person can then ask that bot. Answer it yourself when it fits your job, when it's a quick question any bot could answer, or when no other bot fits better. Hand off only to the bots listed above.`
}

// The conversation is saved to Trigger.dev's transcript storage, keyed by chatId
export const chatAgent = chat
  .withUIMessage<ChatUIMessage>()
  // The bot picked in the composer answers this turn; without one, the chat's
  // first bot does, which is the only bot in a direct chat
  .withClientData({ schema: clientDataSchema })
  .agent({
    id: "chat",
    storage: defaultStorage,
    tools: async ({ chatId, clientData }): Promise<ChatTools> => {
      const { bot, group } = await loadTurn(chatId, clientData)
      const [other, ...rest] = group?.others ?? []
      return {
        ...computerTools(bot.id),
        // Only a group chat with another bot in it has anyone to hand off to,
        // and a message that was handed over must be answered, so handoffs
        // can't bounce between bots
        ...(other && !group?.handedOffBy && handoffTools([other, ...rest])),
      }
    },
    // Reload the bot every turn so edits to it apply mid-conversation
    onTurnStart: async ({ chatId, clientData }) => {
      const turn = await loadTurn(chatId, clientData)
      chat.prompt.set(systemPrompt(turn))
      chat.setUIMessageStreamOptions({
        messageMetadata: ({ part }) =>
          part.type === "start" ? { botId: turn.bot.id } : undefined,
      })
    },
    run: async ({
      messages,
      tools,
      signal,
      streamText,
      chatId,
      clientData,
    }) => {
      // The owner's plan pays for the turn. A thrown error ends just this
      // turn, and its message reaches the composer verbatim
      const { userId, bot } = await loadTurn(chatId, clientData)
      const usage = await getUsage(userId)
      if (!usage) throw new Error("Chatting with bots needs the Pro plan.")
      const remainingMicros = aiRemainingMicros(usage)
      if (remainingMicros <= 0) throw new Error(AI_LIMIT_MESSAGE)

      return streamText({
        model: openai(CHAT_MODEL),
        messages,
        tools,
        abortSignal: signal,
        // Desktop work takes a look and an action per step. A handoff ends
        // the turn, so the bot doesn't answer what it just passed on. A
        // turn also ends once it has spent what was left of the allowance,
        // so one long turn can't run far past it
        stopWhen: [
          isStepCount(50),
          hasToolCall("handoff"),
          ({ steps }) =>
            steps.reduce(
              (spent, step) => spent + aiCostMicros(step.usage),
              0
            ) >= remainingMicros,
        ],
        // Charge each model call as it ends, so a turn that's stopped or
        // fails partway is still charged for the calls it made
        onStepEnd: async ({ usage }) => {
          try {
            await recordAiUsage(userId, usage, { chatId, botId: bot.id })
          } catch (error) {
            console.error(`Failed to record AI usage for ${userId}`, error)
          }
        },
      })
    },
  })
