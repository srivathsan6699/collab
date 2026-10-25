import type { Metadata } from "next"
import { ClerkProvider } from "@clerk/nextjs"
import { shadcn } from "@clerk/ui/themes"
import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toast"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

const description =
  "AI teammates you can hand real work to. Each bot has its own cloud computer to browse, write and get tasks done, and reports back."

export const metadata: Metadata = {
  // Link previews need absolute image URLs, built from this
  metadataBase: new URL("https://collab-production-ea30.up.railway.app"),
  title: { default: "Collab", template: "%s — Collab" },
  description,
  openGraph: {
    siteName: "Collab",
    type: "website",
    title: "Collab — Your AI teammates",
    description,
  },
  twitter: {
    card: "summary_large_image",
    title: "Collab — Your AI teammates",
    description,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        "font-sans",
        geist.variable
      )}
    >
      <body>
        <ClerkProvider
          appearance={{ theme: shadcn, cssLayerName: "components" }}
        >
          <ThemeProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster />
          </ThemeProvider>
        </ClerkProvider>
      </body>
    </html>
  )
}
