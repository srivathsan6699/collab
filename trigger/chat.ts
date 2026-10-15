import { openai } from "@ai-sdk/openai"
import { chat, defaultStorage } from "@trigger.dev/sdk/ai"

// The conversation is saved to Trigger.dev's transcript storage, keyed by chatId
export const chatAgent = chat.agent({
  id: "chat",
  storage: defaultStorage,
  run: async ({ messages, signal, streamText }) =>
    streamText({
      model: openai("gpt-6.1-sol"),
      messages,
      abortSignal: signal,
    }),
})
