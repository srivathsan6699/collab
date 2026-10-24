import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  devIndicators: false,
  // The Daytona SDK loads form-data with a runtime require that the bundler
  // can't follow, which breaks file uploads, so Node loads it unbundled
  serverExternalPackages: ["@daytona/sdk"],
  experimental: {
    agentUpgrade: "security",
  },
}

export default nextConfig
