"use client"

import * as React from "react"
import { cn } from "cn"

import { riggedBotSvg } from "@/components/bot-rig"
import styles from "@/components/bot-scene.module.css"

// A bot that slides out from behind a letter of the headline to wave hello,
// once per visit to the page. Its box starts at the letter's right edge and
// it sits behind the text, so it looks like it's peeking out from behind it.
// Render it inside an inline-block wrapped around that letter
function HelloBot() {
  const [gone, setGone] = React.useState(false)
  if (gone) return null

  return (
    <span
      aria-hidden
      // Wider and taller than the bot, so its head isn't cut off as it leans
      className="pointer-events-none absolute bottom-[0.1em] left-[92%] -z-10 block h-[1.1em] w-[1.3em] overflow-hidden motion-reduce:hidden"
    >
      <span
        className={cn(
          styles.peek,
          "absolute bottom-0 left-0 block size-[0.9em]"
        )}
        // Done once it has slid back; nothing is left running
        onAnimationEnd={(event) => {
          if (event.target === event.currentTarget) setGone(true)
        }}
      >
        <span
          className={cn(styles.rig, "block size-full")}
          data-action="wave"
          dangerouslySetInnerHTML={{ __html: riggedBotSvg("kit-organiser") }}
        />
      </span>
    </span>
  )
}

export { HelloBot }
