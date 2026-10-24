import { createClerkClient } from "@clerk/backend"
import type { LanguageModelUsage } from "ai"
import { addMonths } from "date-fns"
import { and, eq, gte, lt, sql } from "drizzle-orm"

import { PLAN_ALLOWANCES, type PlanSlug } from "@/lib/billing"
import { db } from "@/lib/db/client"
import { usageEvents } from "@/lib/db/schema"

// No server-only guard, so the Trigger.dev chat agent and sandbox meter can
// read and write the ledger too. The worker can't use @clerk/nextjs, so this
// talks to Clerk through @clerk/backend
const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })

// The model every bot answers with; MODEL_PRICES must match it
export const CHAT_MODEL = "gpt-6.1-sol"

// OpenAI's prices for CHAT_MODEL in dollars per million tokens, which is the
// same number as millionths of a dollar per token. Reasoning tokens are
// counted in the output tokens
const MODEL_PRICES = { input: 2, cachedInput: 0.1, output: 10 }

// Daytona's prices in dollars per second, per vCPU and per GiB
const SANDBOX_PRICES = {
  cpu: 0.000014,
  memoryGib: 0.0000045,
  diskGib: 0.00000003,
}

export function aiCostMicros(usage: LanguageModelUsage) {
  const input = usage.inputTokens ?? 0
  const cached = usage.inputTokenDetails?.cacheReadTokens ?? 0
  const output = usage.outputTokens ?? 0
  return Math.ceil(
    (input - cached) * MODEL_PRICES.input +
      cached * MODEL_PRICES.cachedInput +
      output * MODEL_PRICES.output
  )
}

type SandboxSize = { cpu: number; memory: number; disk: number }

function sandboxCostMicros(
  seconds: number,
  { cpu, memory, disk }: SandboxSize
) {
  const perSecond =
    cpu * SANDBOX_PRICES.cpu +
    memory * SANDBOX_PRICES.memoryGib +
    disk * SANDBOX_PRICES.diskGib
  return Math.ceil(seconds * perSecond * 1_000_000)
}

// The window allowances apply to: the month of the user's paid
// subscription period that we're in. Monthly plans reset with each billing
// period; annual plans reset monthly from the day they started
export type UsagePeriod = { plan: PlanSlug; start: Date; end: Date }

function isPlanSlug(slug: string): slug is PlanSlug {
  return slug in PLAN_ALLOWANCES
}

async function fetchUsagePeriod(userId: string): Promise<UsagePeriod | null> {
  let subscription
  try {
    subscription = await clerk.billing.getUserBillingSubscription(userId)
  } catch (error) {
    // A user who never subscribed to anything has no subscription at all
    if ((error as { status?: number }).status === 404) return null
    throw error
  }

  const now = Date.now()
  // Past due keeps the plan's features while Clerk retries the payment, so
  // it keeps the allowance too
  const item = subscription.subscriptionItems.find(
    (item) =>
      (item.status === "active" || item.status === "past_due") &&
      item.plan &&
      isPlanSlug(item.plan.slug) &&
      item.periodStart <= now
  )
  if (!item?.plan) return null

  // Count months from the anchor, not from the last window, so a period
  // that starts on the 31st doesn't drift to the 28th after February
  const anchor = new Date(item.periodStart)
  let months = 0
  while (addMonths(anchor, months + 1).getTime() <= now) months++
  const start = addMonths(anchor, months)
  let end = addMonths(anchor, months + 1)
  if (item.periodEnd && item.periodEnd < end.getTime())
    end = new Date(item.periodEnd)

  return { plan: item.plan.slug as PlanSlug, start, end }
}

// Every gated action and every chat turn reads the period, so it's cached
// briefly to stay clear of Clerk's rate limits. Only paid periods are cached,
// so someone who just subscribed isn't kept waiting
const PERIOD_TTL_MS = 60_000
const periods = new Map<string, { period: UsagePeriod; expires: number }>()

export async function getUsagePeriod(userId: string) {
  const cached = periods.get(userId)
  if (cached && cached.expires > Date.now() && cached.period.end > new Date())
    return cached.period

  const period = await fetchUsagePeriod(userId)
  if (period)
    periods.set(userId, { period, expires: Date.now() + PERIOD_TTL_MS })
  else periods.delete(userId)
  return period
}

export type Usage = {
  period: UsagePeriod
  ai: { tokens: number; usedMicros: number; limitMicros: number }
  sandbox: { seconds: number; limitSeconds: number }
}

// The user's usage this period against their plan's allowance, or null when
// they have no paid plan and so no allowance at all
export async function getUsage(userId: string): Promise<Usage | null> {
  const period = await getUsagePeriod(userId)
  if (!period) return null

  const totals = await db
    .select({
      kind: usageEvents.kind,
      quantity: sql<number>`sum(${usageEvents.quantity})`.mapWith(Number),
      costMicros: sql<number>`sum(${usageEvents.costMicros})`.mapWith(Number),
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.userId, userId),
        gte(usageEvents.createdAt, period.start),
        lt(usageEvents.createdAt, period.end)
      )
    )
    .groupBy(usageEvents.kind)
  const ai = totals.find((total) => total.kind === "ai")
  const sandbox = totals.find((total) => total.kind === "sandbox")
  const allowance = PLAN_ALLOWANCES[period.plan]

  return {
    period,
    ai: {
      tokens: ai?.quantity ?? 0,
      usedMicros: ai?.costMicros ?? 0,
      limitMicros: allowance.aiMicros,
    },
    sandbox: {
      seconds: sandbox?.quantity ?? 0,
      limitSeconds: allowance.sandboxSeconds,
    },
  }
}

// What's left this period; zero or less means the allowance is used up
export function aiRemainingMicros(usage: Usage | null) {
  return usage ? usage.ai.limitMicros - usage.ai.usedMicros : 0
}

export function sandboxRemainingSeconds(usage: Usage | null) {
  return usage ? usage.sandbox.limitSeconds - usage.sandbox.seconds : 0
}

// One model call's tokens, charged as soon as the call ends
export async function recordAiUsage(
  userId: string,
  usage: LanguageModelUsage,
  details: { chatId: string; botId: string }
) {
  const tokens = (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0)
  if (tokens === 0) return

  await db.insert(usageEvents).values({
    userId,
    kind: "ai",
    quantity: tokens,
    costMicros: aiCostMicros(usage),
    details: {
      ...details,
      model: CHAT_MODEL,
      inputTokens: usage.inputTokens ?? 0,
      cachedInputTokens: usage.inputTokenDetails?.cacheReadTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
    },
  })
}

// Running time of one sandbox. The id makes the charge idempotent, so a
// retried meter tick doesn't charge twice
export async function recordSandboxUsage({
  id,
  userId,
  seconds,
  sandbox,
  botId,
}: {
  id: string
  userId: string
  seconds: number
  sandbox: SandboxSize & { id: string }
  botId?: string
}) {
  await db
    .insert(usageEvents)
    .values({
      id,
      userId,
      kind: "sandbox",
      quantity: seconds,
      costMicros: sandboxCostMicros(seconds, sandbox),
      details: {
        sandboxId: sandbox.id,
        botId,
        cpu: sandbox.cpu,
        memory: sandbox.memory,
        disk: sandbox.disk,
      },
    })
    .onConflictDoNothing()
}
