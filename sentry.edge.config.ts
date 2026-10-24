import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ??
    "https://5d2c2069232014b0925d5aca9ced004a@o4512310434398208.ingest.de.sentry.io/4512310488727632",

  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,

  // Sentry.logger calls are sent as logs by default; this adds console
  // warnings and errors
  integrations: [
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],
})
