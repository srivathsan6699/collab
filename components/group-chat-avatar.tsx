import { cn } from "cn"

import { ChatAvatar } from "@/components/chat-avatar"

const MAX_FACES = 3

// Where each item sits in the square, by how many items there are
const layouts: Record<number, { size: string; slots: string[] }> = {
  2: {
    size: "size-[62%]",
    slots: [
      "left-0 top-1/2 -translate-y-1/2",
      "right-0 top-1/2 -translate-y-1/2",
    ],
  },
  3: {
    size: "size-[56%]",
    slots: [
      "top-0 left-1/2 -translate-x-1/2",
      "bottom-0 left-0",
      "bottom-0 right-0",
    ],
  },
  4: {
    size: "size-1/2",
    slots: [
      "top-0 left-0",
      "top-0 right-0",
      "bottom-0 left-0",
      "bottom-0 right-0",
    ],
  },
}

// The faces of a chat's bots in the space of one ChatAvatar: size it with the
// same className. Shows up to three faces and counts the rest.
function GroupChatAvatar({
  seeds,
  className,
}: {
  seeds: string[]
  className?: string
}) {
  if (seeds.length <= 1) {
    return <ChatAvatar seed={seeds[0] ?? ""} className={className} />
  }

  const faces = seeds.slice(0, MAX_FACES)
  const rest = seeds.length - faces.length
  const layout = layouts[faces.length + (rest > 0 ? 1 : 0)]

  return (
    <div
      className={cn("@container relative size-8 shrink-0", className)}
      aria-hidden
    >
      {faces.map((seed, i) => (
        <ChatAvatar
          key={i}
          seed={seed}
          className={cn("absolute bg-muted", layout.size, layout.slots[i])}
        />
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "absolute flex items-center justify-center rounded-full bg-muted text-[22cqw] leading-none font-medium text-muted-foreground tabular-nums",
            layout.size,
            layout.slots[faces.length]
          )}
        >
          +{rest}
        </span>
      )}
    </div>
  )
}

export { GroupChatAvatar }
