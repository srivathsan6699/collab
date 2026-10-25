"use client"

import { useClerk } from "@clerk/nextjs"
import * as React from "react"

import { Button } from "@/components/ui/button"

type WaitlistAppearance = NonNullable<
  Parameters<ReturnType<typeof useClerk>["openWaitlist"]>[0]
>["appearance"]

// Opens Clerk's join-the-waitlist form in a modal. Sign-ups are waitlist
// only, so this is how new visitors ask for access
function WaitlistButton({
  appearance,
  ...props
}: React.ComponentProps<typeof Button> & { appearance?: WaitlistAppearance }) {
  const clerk = useClerk()
  return (
    <Button {...props} onClick={() => clerk.openWaitlist({ appearance })} />
  )
}

export { WaitlistButton }
