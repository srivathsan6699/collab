import { auth } from "@clerk/nextjs/server"
import { PricingTable } from "@clerk/nextjs"

export default async function Page() {
  await auth.protect()

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-4xl flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a plan</h1>
        <p className="text-muted-foreground">
          Pro unlocks bots and their sandboxes: create bots, chat with them, and
          watch their desktops.
        </p>
      </div>
      <PricingTable newSubscriptionRedirectUrl="/" />
    </div>
  )
}
