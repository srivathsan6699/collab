"use client"

import { useChat, type UIMessage } from "@ai-sdk/react"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"
import {
  useLoadTranscript,
  useTriggerChatTransport,
  type InferChatUIMessage,
} from "@trigger.dev/sdk/chat/react"
import {
  ArrowDownUpIcon,
  ArrowRightLeftIcon,
  CircleAlertIcon,
  CodeIcon,
  EyeIcon,
  FilePenIcon,
  FileTextIcon,
  FolderOpenIcon,
  GlobeIcon,
  KeyboardIcon,
  MonitorIcon,
  MouseIcon,
  MousePointerClickIcon,
  MoveIcon,
  PackageIcon,
  SearchIcon,
  TypeIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react"
import * as React from "react"
import { cn } from "cn"

import {
  loadTranscript,
  mintChatAccessToken,
  startChatSession,
} from "@/actions/chat"
import type { chatAgent } from "@/trigger/chat"

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { ChatAvatar } from "@/components/chat-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { useUpgrade } from "@/components/upgrade-toast"
import { AI_LIMIT_MESSAGE, BOT_FEATURES } from "@/lib/billing"

type ChatMessage = InferChatUIMessage<typeof chatAgent>
type ChatPart = ChatMessage["parts"][number]
type ToolPart<Name extends string> = Extract<ChatPart, { type: `tool-${Name}` }>

type PickableBot = { id: string; name: string; avatar: string }

function ChatConversation({
  chatId,
  bots,
}: {
  chatId: string
  // The bots to pick from in a group chat; a direct chat has only its own
  bots?: PickableBot[]
}) {
  const [pickedBotId, setBotId] = React.useState(bots?.[0]?.id)
  // The picked bot may have been removed from the group since
  const botId = bots?.some((bot) => bot.id === pickedBotId)
    ? pickedBotId
    : bots?.[0]?.id
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
    // Sent with every turn, so the agent answers as the picked bot
    clientData: { botId },
  })
  const { messages, isLoading } = useLoadTranscript(chatId, loadTranscript, {
    transport,
  })

  // useChat only reads its initial messages on mount, so wait for history
  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <ChatMessages
      chatId={chatId}
      initialMessages={messages}
      transport={transport}
      bots={bots}
      botId={botId}
      onBotChange={setBotId}
    />
  )
}

function ChatMessages({
  chatId,
  initialMessages,
  transport,
  bots,
  botId,
  onBotChange,
}: {
  chatId: string
  initialMessages: UIMessage[]
  transport: TriggerChatTransport
  bots?: PickableBot[]
  botId?: string
  onBotChange: (botId: string) => void
}) {
  const { requireFeatures, showUsageLimitToast } = useUpgrade()
  const { messages, sendMessage, regenerate, status, stop } =
    useChat<ChatMessage>({
      id: chatId,
      // The transcript holds what the agent streamed, so it has the agent's parts
      messages: initialMessages as ChatMessage[],
      transport,
      // The agent refuses a turn once the AI allowance is used up, with
      // this exact message
      onError: (error) => {
        if (error.message === AI_LIMIT_MESSAGE)
          showUsageLimitToast("Can't send message", AI_LIMIT_MESSAGE)
      },
    })

  function handleSubmit({ text }: PromptInputMessage) {
    if (!text.trim()) return
    if (!requireFeatures(BOT_FEATURES, "Can't send message")) return
    // The message remembers which bot it was for, so a group chat can show it
    sendMessage({ text, metadata: { botId } })
  }

  // Picks the bot a reply handed off to and has it answer in the reply's
  // place. The transport's clientData only catches up on the next render,
  // so the bot goes with the request too, along with who handed it over
  function handOff(message: ChatMessage, botId: string) {
    if (!requireFeatures(BOT_FEATURES, "Can't hand off message")) return
    onBotChange(botId)
    regenerate({
      messageId: message.id,
      metadata: { botId, handedOffBy: message.metadata?.botId },
    })
  }

  return (
    <>
      {/* min-h-0 lets the column shrink it, so only the messages scroll */}
      <Conversation className="min-h-0">
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message, index) => {
            // In a group chat, a reply shows the face of the bot that wrote
            // it, and a message from the person shows the bot it was for
            const bot = bots?.find((bot) => bot.id === message.metadata?.botId)
            const author = message.role === "assistant" ? bot : undefined
            const recipient = message.role === "user" ? bot : undefined
            // Only the latest reply can be answered again, once it's done
            const onHandOff =
              index === messages.length - 1 && status === "ready"
                ? (botId: string) => handOff(message, botId)
                : undefined

            return (
              <Message
                from={message.role}
                key={message.id}
                className={cn(author && "flex-row items-start gap-3")}
              >
                {author && (
                  <ChatAvatar seed={author.avatar} className="size-6" />
                )}
                <MessageContent>
                  {recipient ? (
                    // The badge and the first paragraph share one line, like a
                    // tag. Both are inline so the bubble's fit-content width
                    // counts them together; a float wouldn't be counted
                    <div className="[&>div]:inline [&>div>p:first-child]:inline">
                      <Badge
                        variant="outline"
                        className="mr-1.5 max-w-40 bg-background pl-0.5 align-top"
                      >
                        <ChatAvatar
                          seed={recipient.avatar}
                          className="size-4"
                        />
                        <span className="truncate">{recipient.name}</span>
                      </Badge>
                      {message.parts.map((part, i) => (
                        <ChatMessagePart
                          key={`${message.id}-${i}`}
                          part={part}
                        />
                      ))}
                    </div>
                  ) : (
                    message.parts.map((part, i) => (
                      <ChatMessagePart
                        key={`${message.id}-${i}`}
                        part={part}
                        bots={bots}
                        onHandOff={onHandOff}
                      />
                    ))
                  )}
                </MessageContent>
              </Message>
            )
          })}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter
            className={bots ? "justify-between" : "justify-end"}
          >
            {bots && (
              <PromptInputTools>
                <BotPicker bots={bots} value={botId} onChange={onBotChange} />
              </PromptInputTools>
            )}
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  )
}

// Picks which bot in a group chat answers the next message
function BotPicker({
  bots,
  value,
  onChange,
}: {
  bots: PickableBot[]
  value?: string
  onChange: (botId: string) => void
}) {
  return (
    <PromptInputSelect
      value={value}
      onValueChange={(value) => typeof value === "string" && onChange(value)}
      items={bots.map((bot) => ({ value: bot.id, label: bot.name }))}
    >
      <PromptInputSelectTrigger size="sm" aria-label="Bot to talk to">
        <PromptInputSelectValue>
          {(id: string) => {
            const bot = bots.find((bot) => bot.id === id)
            return bot && <PickableBotLabel bot={bot} />
          }}
        </PromptInputSelectValue>
      </PromptInputSelectTrigger>
      <PromptInputSelectContent>
        {bots.map((bot) => (
          <PromptInputSelectItem key={bot.id} value={bot.id}>
            <PickableBotLabel bot={bot} />
          </PromptInputSelectItem>
        ))}
      </PromptInputSelectContent>
    </PromptInputSelect>
  )
}

function PickableBotLabel({ bot }: { bot: PickableBot }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ChatAvatar seed={bot.avatar} className="size-4" />
      <span className="truncate">{bot.name}</span>
    </span>
  )
}

function ChatMessagePart({
  part,
  bots,
  onHandOff,
}: {
  part: ChatPart
  bots?: PickableBot[]
  onHandOff?: (botId: string) => void
}) {
  switch (part.type) {
    case "text":
      return <MessageResponse>{part.text}</MessageResponse>
    case "tool-bash":
      return <BashTool part={part} />
    case "tool-readFile":
      return <ReadFileTool part={part} />
    case "tool-writeFile":
      return <WriteFileTool part={part} />
    case "tool-listFiles":
      return <ListFilesTool part={part} />
    case "tool-showScreen":
      return <ShowScreenTool part={part} />
    case "tool-handoff":
      return <HandoffTool part={part} bots={bots} onHandOff={onHandOff} />
    // The screenshot is for the bot's eyes only, so it's never rendered
    case "tool-viewScreen":
      return (
        <ComputerStep icon={EyeIcon} label="Looked at the screen" part={part} />
      )
    case "tool-mouseClick": {
      const { x, y, button, double } = part.input ?? {}
      const kind = double
        ? "Double-clicked"
        : button === "right"
          ? "Right-clicked"
          : button === "middle"
            ? "Middle-clicked"
            : "Clicked"
      return (
        <ComputerStep
          icon={MousePointerClickIcon}
          label={`${kind} at ${coords(x, y)}`}
          part={part}
        />
      )
    }
    case "tool-mouseMove":
      return (
        <ComputerStep
          icon={MouseIcon}
          label={`Moved the mouse to ${coords(part.input?.x, part.input?.y)}`}
          part={part}
        />
      )
    case "tool-mouseDrag": {
      const { startX, startY, endX, endY } = part.input ?? {}
      return (
        <ComputerStep
          icon={MoveIcon}
          label={`Dragged from ${coords(startX, startY)} to ${coords(endX, endY)}`}
          part={part}
        />
      )
    }
    case "tool-mouseScroll":
      return (
        <ComputerStep
          icon={ArrowDownUpIcon}
          label={`Scrolled ${part.input?.direction ?? ""} at ${coords(part.input?.x, part.input?.y)}`}
          part={part}
        />
      )
    case "tool-keyboardType":
      return (
        <ComputerStep
          icon={TypeIcon}
          label={`Typed “${part.input?.text ?? ""}”`}
          part={part}
        />
      )
    case "tool-keyboardPress": {
      const keys = [...(part.input?.modifiers ?? []), part.input?.key ?? ""]
      return (
        <ComputerStep
          icon={KeyboardIcon}
          label={`Pressed ${keys.filter(Boolean).join("+")}`}
          part={part}
        />
      )
    }
    default:
      return null
  }
}

function coords(x?: number, y?: number) {
  return `(${x ?? "…"}, ${y ?? "…"})`
}

// A one-line record of a mouse, keyboard or screen action
function ComputerStep({
  icon: Icon,
  label,
  part,
}: {
  icon: LucideIcon
  label: string
  part: Pick<ToolPart<string>, "state" | "errorText">
}) {
  const running =
    part.state === "input-streaming" || part.state === "input-available"
  const failed = part.state === "output-error"
  return (
    <div className="flex min-w-0 items-start gap-2 text-sm text-muted-foreground">
      {running ? (
        <Spinner className="mt-0.5 size-4 shrink-0" />
      ) : failed ? (
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" />
      ) : (
        <Icon className="mt-0.5 size-4 shrink-0" />
      )}
      <div className="min-w-0">
        <p className={cn("truncate", running && "animate-pulse")}>{label}</p>
        {failed && <p className="text-destructive">{part.errorText}</p>}
      </div>
    </div>
  )
}

// What the bot did, said plainly. The command itself is an implementation
// detail, so it's only read to pick the wording
const bashSteps: [RegExp, LucideIcon, string, string][] = [
  [
    /chrom|firefox|xdg-open/,
    GlobeIcon,
    "Opening the browser",
    "Opened the browser",
  ],
  [
    /curl|wget|requests|https?:\/\//,
    SearchIcon,
    "Looking things up online",
    "Looked things up online",
  ],
  [
    /\b(pip|npm|apt(-get)?|brew)\b.*\binstall\b/,
    PackageIcon,
    "Getting tools ready",
    "Got tools ready",
  ],
  [/\b(python3?|node)\b/, CodeIcon, "Running some code", "Ran some code"],
]

function BashTool({ part }: { part: ToolPart<"bash"> }) {
  const command = part.input?.command ?? ""
  const [, icon, running, done] = bashSteps.find(([pattern]) =>
    pattern.test(command)
  ) ?? [, WrenchIcon, "Working on it", "Worked on a step"]
  return <TaskStep icon={icon} running={running} done={done} part={part} />
}

function ReadFileTool({ part }: { part: ToolPart<"readFile"> }) {
  return (
    <TaskStep
      icon={FileTextIcon}
      running="Reading a file"
      done="Read a file"
      part={part}
    />
  )
}

function WriteFileTool({ part }: { part: ToolPart<"writeFile"> }) {
  return (
    <TaskStep
      icon={FilePenIcon}
      running="Saving a file"
      done="Saved a file"
      part={part}
    />
  )
}

function ListFilesTool({ part }: { part: ToolPart<"listFiles"> }) {
  return (
    <TaskStep
      icon={FolderOpenIcon}
      running="Looking through files"
      done="Looked through files"
      part={part}
    />
  )
}

// A behind-the-scenes step, worded for people rather than showing its
// commands, output or raw errors
function TaskStep({
  icon,
  running,
  done,
  part,
}: {
  icon: LucideIcon
  running: string
  done: string
  part: Pick<ToolPart<string>, "state">
}) {
  const label =
    part.state === "output-error" || part.state === "output-denied"
      ? "Hit a snag, trying another way"
      : part.state === "output-available"
        ? done
        : `${running}…`
  return <ComputerStep icon={icon} label={label} part={{ state: part.state }} />
}

function HandoffTool({
  part,
  bots,
  onHandOff,
}: {
  part: ToolPart<"handoff">
  bots?: PickableBot[]
  onHandOff?: (botId: string) => void
}) {
  const bot = bots?.find((bot) => bot.id === part.input?.botId)
  // Still streaming, failed, or handed to a bot that has since left
  if (part.state !== "output-available" || !bot) {
    return (
      <ComputerStep icon={ArrowRightLeftIcon} label="Handing off" part={part} />
    )
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <ArrowRightLeftIcon className="size-4 shrink-0" />
        <span className="shrink-0">Handed off to</span>
        <ChatAvatar seed={bot.avatar} className="size-5" />
        <span className="truncate font-medium text-foreground">{bot.name}</span>
      </div>
      {part.input?.reason && <p className="text-sm">{part.input.reason}</p>}
      {onHandOff && (
        <Button variant="outline" size="sm" onClick={() => onHandOff(bot.id)}>
          Ask {bot.name}
        </Button>
      )}
    </div>
  )
}

function ShowScreenTool({ part }: { part: ToolPart<"showScreen"> }) {
  if (part.state === "output-error" || part.state === "output-denied")
    return (
      <ComputerStep
        icon={MonitorIcon}
        label="Couldn't show the screen"
        part={part}
      />
    )
  if (part.state !== "output-available")
    return <Skeleton className="aspect-4/3 w-full max-w-xl rounded-lg" />

  const { data, mediaType, width, height } = part.output
  return (
    // A base64 screenshot gains nothing from next/image's optimizer
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt="The bot's screen"
      className="w-full max-w-xl rounded-lg border"
      height={height}
      src={`data:${mediaType};base64,${data}`}
      width={width}
    />
  )
}

export { ChatConversation }
