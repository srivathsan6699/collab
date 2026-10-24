"use server"

import { auth as clerkAuth } from "@clerk/nextjs/server"
import { auth } from "@trigger.dev/sdk"
import {
  chat,
  defaultStorage,
  type ChatLoadTranscriptParams,
  type ChatStartSessionParams,
} from "@trigger.dev/sdk/ai"

import { BOT_FEATURES, UPGRADE_REQUIRED } from "@/lib/billing"
import { getChat } from "@/queries/chat"
import type { chatAgent } from "@/trigger/chat"

// chatId comes from the browser, so every action checks the signed-in user
// owns the chat before touching its session or transcript
async function assertChatOwner(chatId: string) {
  if (!(await getChat(chatId))) throw new Error("Chat not found.")
}

// Turns go straight from the browser to Trigger.dev with the session's
// token, so starting a session and minting its token are where chatting is
// gated. The composer checks the plan first and shows the upgrade toast
async function assertCanChat() {
  const { has } = await clerkAuth()
  if (!BOT_FEATURES.every((feature) => has({ feature })))
    throw new Error(UPGRADE_REQUIRED)
}

const start = chat.createStartSessionAction<typeof chatAgent>("chat")

export async function startChatSession(
  params: ChatStartSessionParams<typeof chatAgent>
) {
  await assertChatOwner(params.chatId)
  await assertCanChat()
  return start(params)
}

export async function mintChatAccessToken(chatId: string) {
  await assertChatOwner(chatId)
  await assertCanChat()
  return auth.createPublicToken({
    scopes: { read: { sessions: chatId }, write: { sessions: chatId } },
    expirationTime: "1h",
  })
}

const load = chat.createLoadTranscriptAction(defaultStorage)

export async function loadTranscript(params: ChatLoadTranscriptParams) {
  await assertChatOwner(params.chatId)
  return load(params)
}
