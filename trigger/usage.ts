import { SandboxState, type Sandbox } from "@daytona/sdk"
import * as Sentry from "@sentry/node"
import { logger, schedules } from "@trigger.dev/sdk"

import { daytona } from "@/lib/daytona/client"
import {
  getUsage,
  recordSandboxUsage,
  sandboxRemainingSeconds,
} from "@/lib/usage"

// How often the meter runs, which is also what each running sandbox is
// charged per run. A sandbox started just before a run is charged the whole
// interval
const INTERVAL_SECONDS = 5 * 60

// Charges every running bot sandbox to its owner's usage ledger, then stops
// the sandboxes of anyone without sandbox time left: over their allowance,
// or without a paid plan. Daytona bills a sandbox for as long as it runs,
// including the idle minutes before it auto-stops, so time is metered here
// rather than per tool call
export const meterSandboxes = schedules.task({
  id: "meter-sandboxes",
  cron: "*/5 * * * *",
  maxDuration: 240,
  run: async ({ timestamp }) => {
    const owned = new Map<string, Sandbox[]>()
    for await (const sandbox of daytona.list({
      states: [SandboxState.STARTED],
    })) {
      // Bot sandboxes are labeled with their owner when created; anything
      // else in the Daytona organization isn't ours to meter
      const userId = sandbox.labels.userId
      if (!userId) continue
      owned.set(userId, [...(owned.get(userId) ?? []), sandbox])
    }

    let stopped = 0
    for (const [userId, sandboxes] of owned) {
      for (const sandbox of sandboxes) {
        // Keyed by the scheduled time, so a retried run charges nothing twice
        await recordSandboxUsage({
          id: `sandbox:${sandbox.id}:${timestamp.toISOString()}`,
          userId,
          seconds: INTERVAL_SECONDS,
          sandbox,
          botId: sandbox.labels.botId,
        })
      }

      let usage
      try {
        usage = await getUsage(userId)
      } catch (error) {
        // Without the plan there's no telling whether time is left, so the
        // sandboxes keep running until the next run can check
        logger.error(`Couldn't read the usage of ${userId}`, { error })
        Sentry.logger.error("Couldn't read usage", {
          userId,
          error: String(error),
        })
        continue
      }
      if (sandboxRemainingSeconds(usage) > 0) continue

      const results = await Promise.allSettled(
        sandboxes.map((sandbox) => sandbox.stop())
      )
      results.forEach((result, i) => {
        if (result.status === "fulfilled") stopped++
        else {
          logger.error(`Couldn't stop sandbox ${sandboxes[i].id}`, {
            error: result.reason,
          })
          Sentry.logger.error("Couldn't stop sandbox", {
            userId,
            sandboxId: sandboxes[i].id,
            error: String(result.reason),
          })
        }
      })
    }

    const metered = [...owned.values()].flat().length
    logger.info("Metered sandboxes", { users: owned.size, metered, stopped })
    Sentry.logger.info("Metered sandboxes", {
      users: owned.size,
      metered,
      stopped,
    })
    return { users: owned.size, metered, stopped }
  },
})
