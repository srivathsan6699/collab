import type { NextConfig } from "next"
import { withSentryConfig } from "@sentry/nextjs/config"

const nextConfig: NextConfig = {
  devIndicators: false,
  // The Daytona SDK loads form-data with a runtime require that the bundler
  // can't follow, which breaks file uploads, so Node loads it unbundled
  serverExternalPackages: ["@daytona/sdk"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default withSentryConfig(nextConfig, {
  org: "collab-13",
  project: "collab",

  // Source map upload token, set in the build environment
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Upload a wider set of client source files for better stack traces
  widenClientFileUpload: true,

  // Proxy browser events through the app to get past ad-blockers
  tunnelRoute: "/monitoring",

  silent: !process.env.CI,
})
