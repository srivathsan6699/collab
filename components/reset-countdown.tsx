"use client"

import { format, formatDistanceStrict } from "date-fns"
import { useSyncExternalStore } from "react"

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000)
  return () => clearInterval(id)
}

// Rounded to the minute, so the snapshot only changes when the text would
const getNow = () => Math.floor(Date.now() / 60_000) * 60_000

// The server doesn't know the viewer's clock or time zone
const getServerNow = () => null

// How long until the usage period resets, in the viewer's time zone. Ticks
// every minute so the page doesn't go stale while it's open
function ResetCountdown({ resetsAt }: { resetsAt: string }) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow)
  if (now === null) return null

  const end = new Date(resetsAt)
  if (end.getTime() <= now)
    return <>Resets now. Refresh to see the new period.</>
  return (
    <>
      Resets in {formatDistanceStrict(end, now)}, on{" "}
      {format(end, "MMM d 'at' h:mm a")}
    </>
  )
}

export { ResetCountdown }
