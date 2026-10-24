// Feature slugs from Clerk Billing. The Pro plan includes both; the free plan
// includes neither
export type Feature = "bots" | "sandbox"

// Creating or chatting with a bot runs its sandbox, so both need both
export const BOT_FEATURES: Feature[] = ["bots", "sandbox"]
export const SANDBOX_FEATURES: Feature[] = ["sandbox"]

// Set on an action's failed result when the user's plan doesn't include the
// feature, so the client can point them to the pricing page
export const UPGRADE_REQUIRED = "upgrade_required"

// Set when the plan includes the feature but this period's allowance is
// used up, so the client can point them to the usage page instead
export const USAGE_LIMIT_REACHED = "usage_limit_reached"

// What each paid plan allows per monthly usage period, keyed by Clerk plan
// slug. Pro is $20/month: at most $8 of model tokens plus 50 sandbox hours
// (about $3.35 on Daytona at 1 vCPU and 1 GiB), leaving the rest as margin
export const PLAN_ALLOWANCES = {
  pro: {
    // Model spend, in millionths of a dollar
    aiMicros: 8_000_000,
    sandboxSeconds: 50 * 60 * 60,
  },
} satisfies Record<string, { aiMicros: number; sandboxSeconds: number }>

export type PlanSlug = keyof typeof PLAN_ALLOWANCES

// Sent to the browser verbatim as the chat's error, so the composer can
// recognize it and offer the usage page
export const AI_LIMIT_MESSAGE =
  "You've used all your AI usage for this period. It resets with your next usage period."

export const SANDBOX_LIMIT_MESSAGE =
  "You've used all your sandbox time for this period. It resets with your next usage period."
