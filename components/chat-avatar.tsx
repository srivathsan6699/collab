import Image from "next/image"
import { Avatar, Style } from "@dicebear/core"
import voxelBot from "@dicebear/styles/voxel-bot.json" with { type: "json" }
import { cn } from "cn"

const style = new Style(voxelBot)

function ChatAvatar({
  seed,
  animated = false,
  className,
}: {
  seed: string
  animated?: boolean
  className?: string
}) {
  const src = new Avatar(style, {
    seed,
    tags: [animated ? "animation" : "!animation"],
  }).toDataUri()

  return (
    <Image
      src={src}
      alt=""
      width={32}
      height={32}
      unoptimized
      className={cn("size-8 shrink-0 rounded-full", className)}
    />
  )
}

export { ChatAvatar }
