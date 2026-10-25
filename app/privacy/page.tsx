import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Collab collects, why, and who it's shared with.",
}

const issuesUrl = "https://github.com/srivathsan6699/collab/issues"

// Public, so it lives outside the dashboard and its sign-in check
export default function PrivacyPage() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="ps-2 font-heading text-lg font-semibold tracking-tight"
        >
          Collab
        </Link>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 sm:px-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          Privacy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated 25 October 2026
        </p>

        <div className="mt-10 flex flex-col gap-10 text-sm leading-relaxed text-muted-foreground [&_h2]:mb-3 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_li]:mt-1.5 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
          <section>
            <p>
              Collab lets you create AI bots that work on tasks for you. This
              page explains what information that involves, why it&apos;s needed
              and who helps us run the service. We only collect what the product
              needs to work, and we never sell your data or show you ads.
            </p>
          </section>

          <section>
            <h2>What we collect</h2>
            <ul>
              <li>
                <strong>Your account:</strong> your name, email address and
                profile picture, if you sign in with Google, so you can sign in
                and we know which bots and chats are yours.
              </li>
              <li>
                <strong>What you create:</strong> your bots (their names, jobs
                and instructions), your chats and the messages in them.
              </li>
              <li>
                <strong>Your bots&apos; work:</strong> each bot has its own
                cloud computer. Files it creates, the websites it visits and a
                memory file it keeps to remember things between chats all live
                there.
              </li>
              <li>
                <strong>Usage:</strong> how much AI and computer time you use,
                so we can apply your plan&apos;s limits.
              </li>
              <li>
                <strong>Errors:</strong> when something breaks, technical
                details such as the page, your browser and what went wrong, so
                we can fix it.
              </li>
            </ul>
          </section>

          <section>
            <h2>Who helps us run Collab</h2>
            <p className="mb-3">
              We share information with these services only as far as each one
              needs it to do its job:
            </p>
            <ul>
              <li>
                <strong>Clerk</strong> handles sign-in, accounts and
                subscriptions. Payments are processed by Clerk&apos;s payment
                provider, and we never see your card details.
              </li>
              <li>
                <strong>OpenAI</strong> receives your messages and the
                bot&apos;s context so the bot can reply.
              </li>
              <li>
                <strong>Daytona</strong> runs each bot&apos;s cloud computer.
              </li>
              <li>
                <strong>Neon</strong> stores bots, chats and usage records.
              </li>
              <li>
                <strong>Trigger.dev</strong> runs your bots&apos; replies in the
                background and keeps the conversation history.
              </li>
              <li>
                <strong>Railway</strong> hosts the website.
              </li>
              <li>
                <strong>Sentry</strong> receives error reports and performance
                data. It doesn&apos;t record your visits.
              </li>
            </ul>
          </section>

          <section>
            <h2>Cookies</h2>
            <p>
              Collab only uses cookies and browser storage that the site needs
              to work: keeping you signed in, and remembering choices you make,
              like light or dark mode and whether the sidebar is open. There are
              no advertising or analytics cookies, so there&apos;s nothing to
              consent to.
            </p>
          </section>

          <section>
            <h2>How long we keep it</h2>
            <p>
              Your bots and chats stay until you delete them. Deleting a bot
              also deletes its cloud computer, everything on it, and its
              one-to-one chats. Usage records are kept for billing.
            </p>
          </section>

          <section>
            <h2>Your choices</h2>
            <p>
              You can ask for a copy of your data, ask us to correct it, or ask
              us to delete your account and everything in it. Deleting your
              sign-in account alone doesn&apos;t yet remove your bots and chats,
              so please get in touch and we&apos;ll remove them for you. Reach
              us by{" "}
              <a
                href={issuesUrl}
                className="text-foreground underline underline-offset-4"
              >
                opening an issue on GitHub
              </a>
              .
            </p>
          </section>
        </div>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Collab
      </footer>
    </div>
  )
}
