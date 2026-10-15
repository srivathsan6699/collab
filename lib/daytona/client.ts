import { Daytona } from "@daytona/sdk"

// Next.js and `trigger dev` both load .env.local into process.env. The SDK
// refuses to pick an endpoint that is set in both places, so pass ours
// explicitly. No server-only guard, so Trigger.dev tasks can use it too.
// Next.js code imports @/lib/daytona, which keeps the guard
export const daytona = new Daytona({
  apiKey: process.env.DAYTONA_API_KEY,
  apiUrl: process.env.DAYTONA_API_URL,
})
