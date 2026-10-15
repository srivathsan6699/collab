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
  CircleAlertIcon,
  EyeIcon,
  FileIcon,
  FilePenIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  KeyboardIcon,
  MonitorIcon,
  MouseIcon,
  MousePointerClickIcon,
  MoveIcon,
  SquareTerminalIcon,
  TypeIcon,
  type LucideIcon,
} from "lucide-react"
import type { BundledLanguage } from "shiki"

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
import { CodeBlock } from "@/components/ai-elements/code-block"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { Terminal } from "@/components/ai-elements/terminal"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@/components/ai-elements/tool"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"

type ChatMessage = InferChatUIMessage<typeof chatAgent>
type ChatPart = ChatMessage["parts"][number]
type ToolPart<Name extends string> = Extract<ChatPart, { type: `tool-${Name}` }>

function ChatConversation({ chatId }: { chatId: string }) {
  const transport = useTriggerChatTransport<typeof chatAgent>({
    task: "chat",
    accessToken: ({ chatId }) => mintChatAccessToken(chatId),
    startSession: ({ chatId, clientData }) =>
      startChatSession({ chatId, clientData }),
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
    />
  )
}

function ChatMessages({
  chatId,
  initialMessages,
  transport,
}: {
  chatId: string
  initialMessages: UIMessage[]
  transport: TriggerChatTransport
}) {
  const { messages, sendMessage, status, stop } = useChat<ChatMessage>({
    id: chatId,
    // The transcript holds what the agent streamed, so it has the agent's parts
    messages: initialMessages as ChatMessage[],
    transport,
  })

  function handleSubmit({ text }: PromptInputMessage) {
    if (!text.trim()) return
    sendMessage({ text })
  }

  return (
    <>
      <Conversation>
        <ConversationContent className="mx-auto w-full max-w-3xl">
          {messages.map((message) => (
            <Message from={message.role} key={message.id}>
              <MessageContent>
                {message.parts.map((part, i) => (
                  <ChatMessagePart key={`${message.id}-${i}`} part={part} />
                ))}
              </MessageContent>
            </Message>
          ))}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className="mx-auto w-full max-w-3xl px-4 pb-4">
        <PromptInput onSubmit={handleSubmit}>
          <PromptInputBody>
            <PromptInputTextarea />
          </PromptInputBody>
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </>
  )
}

function ChatMessagePart({ part }: { part: ChatPart }) {
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
        <p className="truncate">{label}</p>
        {failed && <p className="text-destructive">{part.errorText}</p>}
      </div>
    </div>
  )
}

function BashTool({ part }: { part: ToolPart<"bash"> }) {
  const command = part.input?.command ?? ""
  const output =
    part.state === "output-available"
      ? `$ ${command}\n${part.output.output}${part.output.exitCode === 0 ? "" : `\n\x1b[31mexit code ${part.output.exitCode}\x1b[0m`}`
      : `$ ${command}`
  return (
    <Tool defaultOpen={part.state === "output-error"}>
      <ToolHeader
        icon={<SquareTerminalIcon className="size-4 text-muted-foreground" />}
        state={part.state}
        title={command || "Running a command"}
        type={part.type}
        className="[&_span]:font-mono"
      />
      <ToolContent>
        <Terminal
          isStreaming={part.state === "input-available"}
          output={output}
        />
        <ToolOutput errorText={part.errorText} output={undefined} />
      </ToolContent>
    </Tool>
  )
}

function ReadFileTool({ part }: { part: ToolPart<"readFile"> }) {
  const path = part.input?.path ?? ""
  return (
    <Tool defaultOpen={part.state === "output-error"}>
      <ToolHeader
        icon={<FileTextIcon className="size-4 text-muted-foreground" />}
        state={part.state}
        title={`Read ${path}`}
        type={part.type}
      />
      <ToolContent>
        {part.state === "output-available" && (
          <CodeBlock code={part.output.content} language={languageOf(path)} />
        )}
        <ToolOutput errorText={part.errorText} output={undefined} />
      </ToolContent>
    </Tool>
  )
}

function WriteFileTool({ part }: { part: ToolPart<"writeFile"> }) {
  const path = part.input?.path ?? ""
  return (
    <Tool defaultOpen={part.state === "output-error"}>
      <ToolHeader
        icon={<FilePenIcon className="size-4 text-muted-foreground" />}
        state={part.state}
        title={`Wrote ${path}`}
        type={part.type}
      />
      <ToolContent>
        <CodeBlock
          code={part.input?.content ?? ""}
          language={languageOf(path)}
        />
        <ToolOutput errorText={part.errorText} output={undefined} />
      </ToolContent>
    </Tool>
  )
}

function ListFilesTool({ part }: { part: ToolPart<"listFiles"> }) {
  return (
    <Tool defaultOpen={part.state === "output-error"}>
      <ToolHeader
        icon={<FolderOpenIcon className="size-4 text-muted-foreground" />}
        state={part.state}
        title={`Listed ${part.input?.path ?? "files"}`}
        type={part.type}
      />
      <ToolContent>
        {part.state === "output-available" &&
          (part.output.files.length === 0 ? (
            <p className="text-sm text-muted-foreground">Empty folder</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {part.output.files.map((file) => (
                <li className="flex items-center gap-2" key={file.name}>
                  {file.isDir ? (
                    <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <FileIcon className="size-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate">{file.name}</span>
                  {!file.isDir && (
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        <ToolOutput errorText={part.errorText} output={undefined} />
      </ToolContent>
    </Tool>
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

const languages: Record<string, BundledLanguage> = {
  css: "css",
  go: "go",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  md: "markdown",
  py: "python",
  rs: "rust",
  sh: "bash",
  sql: "sql",
  toml: "toml",
  ts: "typescript",
  tsx: "tsx",
  yaml: "yaml",
  yml: "yaml",
}

function languageOf(path: string): BundledLanguage {
  return languages[path.split(".").pop()?.toLowerCase() ?? ""] ?? "log"
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export { ChatConversation }
