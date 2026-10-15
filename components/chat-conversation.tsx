"use client"

import { useChat, type UIMessage } from "@ai-sdk/react"
import type { TriggerChatTransport } from "@trigger.dev/sdk/chat"
import {
  useLoadTranscript,
  useTriggerChatTransport,
} from "@trigger.dev/sdk/chat/react"

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
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input"
import { Spinner } from "@/components/ui/spinner"

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
  const { messages, sendMessage, status, stop } = useChat({
    id: chatId,
    messages: initialMessages,
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
                {message.parts.map((part, i) =>
                  part.type === "text" ? (
                    <MessageResponse key={`${message.id}-${i}`}>
                      {part.text}
                    </MessageResponse>
                  ) : null
                )}
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

export { ChatConversation }
