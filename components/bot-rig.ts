import { Avatar, Style } from "@dicebear/core"
import voxelBot from "@dicebear/styles/voxel-bot.json" with { type: "json" }

// The voxel bot from ChatAvatar, with its limbs wrapped in groups so the
// landing page can animate them. Only grouping changes, never a shape or a
// colour, so a seed draws exactly the same bot as everywhere else

type Element = {
  name: string
  type: string
  attributes?: Record<string, unknown>
  children?: Element[]
}

function group(name: string, children: Element[]): Element {
  return { name: "g", type: "element", attributes: { class: name }, children }
}

// Positions in the hand-authored definition: feet, then legs, then the upper
// body, whose arms sit either side of the torso
function rig(definition: typeof voxelBot) {
  const rigged = structuredClone(definition) as unknown as {
    canvas: { elements: Element[] }
  }
  const [shadow, ...lower] = rigged.canvas.elements
  const upper = lower.at(-1)
  if (lower.length !== 13 || upper?.attributes?.class !== "vb-upper") {
    throw new Error("The voxel bot's layout changed; update bot-rig.ts")
  }

  const parts = upper.children!
  upper.children = [
    parts[0],
    group("rig-arm-l", parts.slice(1, 12)),
    parts[12],
    ...parts.slice(13, 17),
    group("rig-arm-r", parts.slice(17, 28)),
    ...parts.slice(28),
  ]
  rigged.canvas.elements = [
    shadow,
    group("rig-leg-l", [...lower.slice(0, 3), ...lower.slice(6, 9)]),
    group("rig-leg-r", [...lower.slice(3, 6), ...lower.slice(9, 12)]),
    upper,
  ]
  return rigged
}

const style = new Style(rig(voxelBot) as unknown as typeof voxelBot)
const cache = new Map<string, string>()

// The bot as SVG markup, minus the coloured square behind it, so it can
// stand on the page. Markup rather than an <img> so CSS reaches the limbs
function riggedBotSvg(seed: string) {
  let svg = cache.get(seed)
  if (!svg) {
    svg = new Avatar(style, { seed, tags: ["animation"] })
      .toString()
      .replace(/<rect width="128" height="128" fill="#[0-9a-f]{6}"\/>/i, "")
    cache.set(seed, svg)
  }
  return svg
}

export { riggedBotSvg }
