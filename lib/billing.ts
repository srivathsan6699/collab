// Feature slugs from Clerk Billing. The Pro plan includes both; the free plan
// includes neither
export type Feature = "bots" | "sandbox"

// Creating or chatting with a bot runs its sandbox, so both need both
export const BOT_FEATURES: Feature[] = ["bots", "sandbox"]
export const SANDBOX_FEATURES: Feature[] = ["sandbox"]

// Set on an action's failed result when the user's plan doesn't include the
// feature, so the client can point them to the pricing page
export const UPGRADE_REQUIRED = "upgrade_required"
