import * as Sentry from "@sentry/node"
import { tasks } from "@trigger.dev/sdk"

// Trigger.dev loads this file before every run
Sentry.init({
  dsn: process.env.SENTRY_DSN ?? "https://5d2c2069232014b0925d5aca9ced004a@o4512310434398208.ingest.de.sentry.io/4512310488727632",
  environment: process.env.TRIGGER_ENVIRONMENT ?? process.env.NODE_ENV,

  // Trigger.dev runs its own OpenTelemetry setup, which Sentry's default
  // integrations would clash with, so only error capture is kept
  defaultIntegrations: false,
})

// Fires once a run has used up its retries
tasks.onFailure(async ({ payload, error, ctx }) => {
  Sentry.captureException(error, {
    tags: { task: ctx.task.id, environment: ctx.environment.slug },
    extra: { runId: ctx.run.id, attempt: ctx.attempt.number, payload },
  })
  // The worker can exit right after the hook, so send before returning
  await Sentry.flush(2000)
})
