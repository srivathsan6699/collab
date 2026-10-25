import type { Metadata } from "next"
import { SignInButton } from "@clerk/nextjs"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { BotScene } from "@/components/bot-scene"
import { HelloBot } from "@/components/hello-bot"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "Collab — Your AI teammates",
  description:
    "Hand your work to AI bots that act like teammates. They research, write, browse and get it done while you get on with your day.",
}

// Clerk opens its modal near the top of the screen; centre it instead,
// still scrolling if the window is too short
const centeredModal = {
  elements: { modalBackdrop: "items-center", modalContent: "my-auto" },
}

// Signed-out visitors to / land here; proxy.ts rewrites the URL
export default function WelcomePage() {
  return (
    <div className="flex min-h-svh flex-col overflow-x-hidden">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="ps-2 font-heading text-lg font-semibold tracking-tight">
          Collab
        </span>
        <SignInButton mode="modal" appearance={centeredModal}>
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </SignInButton>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-16 px-4 py-16 sm:gap-20 sm:px-6">
        <section className="flex max-w-2xl flex-col items-center gap-6 text-center motion-safe:animate-in motion-safe:duration-700 motion-safe:fade-in motion-safe:slide-in-from-bottom-4">
          <h1 className="font-heading text-4xl font-semibold tracking-tighter text-balance sm:text-6xl">
            Meet Colla
            <span className="relative inline-block">
              b
              <HelloBot />
            </span>
            .
            <br />
            <span className="text-muted-foreground">Your AI teammates.</span>
          </h1>
          <p className="max-w-lg text-base text-balance text-muted-foreground sm:text-lg">
            Give a bot a job, from booking flights to cleaning up a spreadsheet.
            It opens a browser, does the work and reports back, like a teammate
            would.
          </p>
          <SignInButton mode="modal" appearance={centeredModal}>
            <Button size="lg" className="mt-2 h-11 rounded-full px-6 text-base">
              Try Collab
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </SignInButton>
        </section>

        <section
          aria-label="A team of Collab bots at work"
          className="w-full motion-safe:animate-in motion-safe:duration-1000 motion-safe:[animation-delay:200ms] motion-safe:[animation-fill-mode:both] motion-safe:fade-in"
        >
          <BotScene />
        </section>
      </main>

      <footer className="flex justify-center gap-4 px-4 py-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} Collab</span>
        <Link href="/privacy" className="hover:text-foreground">
          Privacy
        </Link>
      </footer>
    </div>
  )
}
