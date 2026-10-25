"use client"

import {
  CircleCheckIcon,
  CircleXIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  MailIcon,
  PlaneIcon,
  SearchIcon,
  UtensilsIcon,
  type LucideIcon,
} from "lucide-react"
import * as React from "react"
import { cn } from "cn"

import { riggedBotSvg } from "@/components/bot-rig"
import styles from "@/components/bot-scene.module.css"
import { ChatAvatar } from "@/components/chat-avatar"
import { Spinner } from "@/components/ui/spinner"

// The landing page's demo of Collab in one loop: tasks are handed to bots,
// the bots work on them at their desks, and finished tasks land in Done.
// A stuck task gets a teammate's help, and the team celebrates at the end

type BotId = "ada" | "milo" | "rex"
type TaskIndex = 0 | 1 | 2
type Action =
  | "idle"
  | "walk"
  | "work"
  | "celebrate"
  | "frustrated"
  | "kick"
  | "wave"
  | "dance"
type Facing = "left" | "right"
type Phase = "queued" | "assigning" | "working" | "stuck" | "done" | "cleared"

// Where on the floor something stands: u runs left to right, v back to front
type FloorPoint = { u: number; v: number }
type Spot = { desk: BotId } | { kick: BotId } | "aisle"
type Point = { x: number; y: number }
type Rect = { x: number; y: number; width: number; height: number }

const bots: BotId[] = ["ada", "milo", "rex"]
// Each task goes to the bot at the same position
const assignee: Record<TaskIndex, BotId> = { 0: "ada", 1: "milo", 2: "rex" }

const seeds: Record<BotId, string> = {
  ada: "ada-planner",
  milo: "milo-writer",
  rex: "rex-analyst",
}

// Alternate loops hand out different work
const taskSets: { title: string; icon: LucideIcon }[][] = [
  [
    { title: "Book flights", icon: PlaneIcon },
    { title: "Launch email", icon: MailIcon },
    { title: "Sales sheet", icon: FileSpreadsheetIcon },
  ],
  [
    { title: "Team dinner", icon: UtensilsIcon },
    { title: "CRM research", icon: SearchIcon },
    { title: "Weekly report", icon: FileTextIcon },
  ],
]

// How long each bot's task takes while it's actually progressing, so the
// monitor's bar fills as the script plays out
const workMs: Record<BotId, number> = { ada: 5600, milo: 11000, rex: 9650 }

// Positions are percentages of the stage, sizes are container units
type Layout = {
  aspect: number
  floor: {
    cx: number
    width: number
    frontY: number
    backY: number
    depth: number
  }
  desks: Record<BotId, FloorPoint>
  aisle: FloorPoint
  bot: number
  monitor: number
  monitorOffset: FloorPoint
  kickOffset: FloorPoint
  // Compact cards drop the task icon and the assignee's face, for phones
  card: { width: number; onBot: number; compact: boolean }
  panels: { tasks: Rect; done: Rect }
  queue: Point[]
  done: Point[]
}

const wide: Layout = {
  aspect: 2.6,
  floor: { cx: 50, width: 60, frontY: 99, backY: 40, depth: 1.5 },
  desks: {
    ada: { u: 0.14, v: 0.74 },
    milo: { u: 0.47, v: 0.74 },
    rex: { u: 0.8, v: 0.74 },
  },
  aisle: { u: 0.5, v: 0.98 },
  bot: 30,
  monitor: 21,
  monitorOffset: { u: 0.09, v: -0.1 },
  kickOffset: { u: 0.1, v: 0.03 },
  card: { width: 16, onBot: 0.74, compact: false },
  panels: {
    tasks: { x: 0, y: 12, width: 19, height: 54 },
    done: { x: 81, y: 12, width: 19, height: 54 },
  },
  queue: [
    { x: 9.5, y: 24 },
    { x: 9.5, y: 37 },
    { x: 9.5, y: 50 },
  ],
  done: [
    { x: 90.5, y: 24 },
    { x: 90.5, y: 37 },
    { x: 90.5, y: 50 },
  ],
}

// Phones put the task list above the floor and Done below it, with each
// monitor behind its bot
const narrow: Layout = {
  aspect: 0.66,
  floor: { cx: 50, width: 100, frontY: 79, backY: 27, depth: 1.7 },
  desks: {
    ada: { u: 0.13, v: 0.72 },
    milo: { u: 0.5, v: 0.72 },
    rex: { u: 0.87, v: 0.72 },
  },
  aisle: { u: 0.5, v: 0.98 },
  bot: 21,
  monitor: 15,
  monitorOffset: { u: 0, v: -0.38 },
  kickOffset: { u: -0.15, v: 0.06 },
  card: { width: 31, onBot: 0.85, compact: true },
  panels: {
    tasks: { x: 0, y: 0, width: 100, height: 19 },
    done: { x: 0, y: 81, width: 100, height: 19 },
  },
  queue: [
    { x: 17, y: 7.5 },
    { x: 50, y: 7.5 },
    { x: 83, y: 7.5 },
  ],
  done: [
    { x: 17, y: 88.5 },
    { x: 50, y: 88.5 },
    { x: 83, y: 88.5 },
  ],
}

// A perspective projection of the floor: things further back sit higher,
// closer to the middle and smaller, so the flat bots stand in real depth
function project(layout: Layout, { u, v }: FloorPoint) {
  const { cx, width, frontY, backY, depth } = layout.floor
  const s = 1 / (depth - (depth - 1) * v)
  const back = 1 / depth
  return {
    x: cx + (u - 0.5) * width * s,
    y: backY + ((s - back) / (1 - back)) * (frontY - backY),
    s,
  }
}

function monitorAt(layout: Layout, bot: BotId): FloorPoint {
  const desk = layout.desks[bot]
  return {
    u: desk.u + layout.monitorOffset.u,
    v: desk.v + layout.monitorOffset.v,
  }
}

function resolve(layout: Layout, spot: Spot): FloorPoint {
  if (spot === "aisle") return layout.aisle
  if ("desk" in spot) return layout.desks[spot.desk]
  const monitor = monitorAt(layout, spot.kick)
  return {
    u: monitor.u + layout.kickOffset.u,
    v: monitor.v + layout.kickOffset.v,
  }
}

type Bot = { spot: Spot; action: Action; facing: Facing; walkMs: number }
type Task = { phase: Phase; slot: number | null }
type Scene = {
  loop: number
  bots: Record<BotId, Bot>
  tasks: Task[]
  jolts: Record<BotId, number>
}

function initialScene(loop: number): Scene {
  return {
    loop,
    bots: Object.fromEntries(
      bots.map((id) => [
        id,
        { spot: { desk: id }, action: "idle", facing: "right", walkMs: 0 },
      ])
    ) as Record<BotId, Bot>,
    tasks: [0, 1, 2].map(() => ({ phase: "queued", slot: null })),
    jolts: { ada: 0, milo: 0, rex: 0 },
  }
}

// Shown instead of the loop to people who prefer less motion: one task
// done, one under way, one waiting
const stillScene: Scene = {
  ...initialScene(0),
  bots: {
    ada: { spot: { desk: "ada" }, action: "idle", facing: "right", walkMs: 0 },
    milo: {
      spot: { desk: "milo" },
      action: "work",
      facing: "right",
      walkMs: 0,
    },
    rex: { spot: { desk: "rex" }, action: "idle", facing: "right", walkMs: 0 },
  },
  tasks: [
    { phase: "done", slot: 0 },
    { phase: "working", slot: null },
    { phase: "queued", slot: null },
  ],
}

type Leg = { to: Spot; ms: number }
type Step =
  | {
      at: number
      bot: BotId
      action?: Action
      walk?: Leg[]
      // What to do on arriving, and whose monitor to face then
      then?: Action
      faceMonitorOf?: BotId
      face?: Facing
    }
  | { at: number; task: TaskIndex; phase: Phase }
  | { at: number; jolt: BotId }

// One loop. A card is offered to its bot, flies over, and the bot gets to
// work; Rex's task gets stuck until Ada kicks his monitor
const script: Step[] = [
  { at: 700, task: 0, phase: "assigning" },
  { at: 1200, task: 0, phase: "working" },
  { at: 1700, bot: "ada", action: "wave" },
  { at: 2100, bot: "ada", action: "work" },
  { at: 1500, task: 1, phase: "assigning" },
  { at: 2000, task: 1, phase: "working" },
  { at: 2500, bot: "milo", action: "wave" },
  { at: 2900, bot: "milo", action: "work" },
  { at: 2300, task: 2, phase: "assigning" },
  { at: 2800, task: 2, phase: "working" },
  { at: 3300, bot: "rex", action: "wave" },
  { at: 3700, bot: "rex", action: "work" },
  { at: 6800, task: 0, phase: "done" },
  { at: 6800, bot: "ada", action: "celebrate" },
  { at: 8000, task: 2, phase: "stuck" },
  { at: 8000, bot: "rex", action: "frustrated" },
  { at: 8100, bot: "ada", action: "idle" },
  {
    at: 8800,
    bot: "ada",
    walk: [
      { to: "aisle", ms: 1000 },
      { to: { kick: "rex" }, ms: 1200 },
    ],
    then: "idle",
    faceMonitorOf: "rex",
  },
  { at: 11100, bot: "ada", action: "kick" },
  { at: 11350, jolt: "rex" },
  { at: 11350, task: 2, phase: "working" },
  { at: 11400, bot: "rex", action: "wave" },
  { at: 11900, bot: "rex", action: "work" },
  {
    at: 11900,
    bot: "ada",
    walk: [
      { to: "aisle", ms: 1200 },
      { to: { desk: "ada" }, ms: 1000 },
    ],
    then: "idle",
    face: "right",
  },
  { at: 13000, task: 1, phase: "done" },
  { at: 13000, bot: "milo", action: "celebrate" },
  { at: 15000, bot: "milo", action: "idle" },
  { at: 15800, task: 2, phase: "done" },
  { at: 15800, bot: "rex", action: "celebrate" },
  ...bots.map((bot) => ({ at: 16600, bot, action: "dance" as const })),
  ...bots.map((bot) => ({ at: 19400, bot, action: "idle" as const })),
  ...([0, 1, 2] as const).map((task) => ({
    at: 19600,
    task,
    phase: "cleared" as const,
  })),
]
script.sort((a, b) => a.at - b.at)
const loopMs = 20600

type Director = { cursor: number; loopStart: number; loop: number }

// Plays the script from where it left off and returns a stop function.
// Walks under way finish instantly on stop, so no bot is left mid-stride
function play(
  director: Director,
  layout: Layout,
  setScene: React.Dispatch<React.SetStateAction<Scene>>
) {
  let timer: ReturnType<typeof setTimeout>
  const pending = new Map<ReturnType<typeof setTimeout>, () => void>()
  // Where each bot is headed, for working out which way it faces
  const spots = new Map<BotId, Spot>()

  function update(id: BotId, patch: Partial<Bot>) {
    setScene((scene) => ({
      ...scene,
      bots: { ...scene.bots, [id]: { ...scene.bots[id], ...patch } },
    }))
  }

  function later(ms: number, run: () => void) {
    const id = setTimeout(() => {
      pending.delete(id)
      run()
    }, ms)
    pending.set(id, run)
  }

  function walk(id: BotId, from: Spot, legs: Leg[], arrive: () => void) {
    const [leg, ...rest] = legs
    const a = project(layout, resolve(layout, from))
    const b = project(layout, resolve(layout, leg.to))
    spots.set(id, leg.to)
    update(id, {
      spot: leg.to,
      action: "walk",
      walkMs: leg.ms,
      ...(a.x !== b.x && { facing: b.x < a.x ? "left" : "right" }),
    })
    later(leg.ms, () =>
      rest.length ? walk(id, leg.to, rest, arrive) : arrive()
    )
  }

  function apply(step: Step) {
    if ("jolt" in step) {
      setScene((scene) => ({
        ...scene,
        jolts: { ...scene.jolts, [step.jolt]: scene.jolts[step.jolt] + 1 },
      }))
      return
    }
    if ("task" in step) {
      setScene((scene) => {
        const tasks = scene.tasks.map((task, index) => {
          if (index !== step.task) return task
          // Finished tasks stack up in Done in the order they finish
          const slot =
            step.phase === "done"
              ? scene.tasks.filter((task) => task.slot !== null).length
              : task.slot
          return { phase: step.phase, slot }
        })
        return { ...scene, tasks }
      })
      return
    }

    const { bot: id, action, walk: legs, then, faceMonitorOf, face } = step
    if (!legs) {
      update(id, { action })
      return
    }
    walk(id, spots.get(id) ?? { desk: id }, legs, () => {
      let facing = face
      if (faceMonitorOf) {
        const here = resolve(layout, legs.at(-1)!.to)
        const monitor = monitorAt(layout, faceMonitorOf)
        facing = monitor.u < here.u ? "left" : "right"
      }
      update(id, { action: then ?? "idle", ...(facing && { facing }) })
    })
  }

  function next() {
    const step = script[director.cursor]
    if (!step) {
      timer = setTimeout(
        () => {
          director.loop++
          director.cursor = 0
          director.loopStart = performance.now()
          spots.clear()
          setScene(initialScene(director.loop))
          next()
        },
        director.loopStart + loopMs - performance.now()
      )
      return
    }
    timer = setTimeout(
      () => {
        apply(step)
        director.cursor++
        next()
      },
      director.loopStart + step.at - performance.now()
    )
  }

  // Resuming keeps the usual gap between the last step and the next
  director.loopStart =
    performance.now() - (script[director.cursor - 1]?.at ?? 0)
  next()

  return () => {
    clearTimeout(timer)
    // Finish walks (and their later legs) at once
    while (pending.size) {
      for (const [id, run] of pending) {
        clearTimeout(id)
        pending.delete(id)
        run()
      }
    }
  }
}

function useMediaQuery(query: string) {
  return React.useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query)
      mql.addEventListener("change", onChange)
      return () => mql.removeEventListener("change", onChange)
    },
    () => window.matchMedia(query).matches,
    // Unknown on the server, so the stage waits for the browser
    () => null
  )
}

function BotScene() {
  const isWide = useMediaQuery("(min-width: 768px)")
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const layout = isWide === null ? null : isWide ? wide : narrow
  const [playing, setPlaying] = React.useState(() => initialScene(0))
  const [onScreen, setOnScreen] = React.useState(false)
  const stageRef = React.useRef<HTMLDivElement>(null)
  const directorRef = React.useRef<Director>(null)

  React.useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let inView = false
    const update = () => setOnScreen(inView && !document.hidden)
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      update()
    })
    observer.observe(stage)
    document.addEventListener("visibilitychange", update)
    return () => {
      observer.disconnect()
      document.removeEventListener("visibilitychange", update)
    }
  }, [])

  const running = layout !== null && onScreen && reducedMotion === false
  React.useEffect(() => {
    if (!running || !layout) return
    directorRef.current ??= { cursor: 0, loopStart: 0, loop: 0 }
    return play(directorRef.current, layout, setPlaying)
  }, [running, layout])

  const scene = reducedMotion ? stillScene : playing
  const tasks = taskSets[scene.loop % taskSets.length]
  const doneCount = scene.tasks.filter((task) => task.slot !== null).length

  return (
    <div
      ref={stageRef}
      role="img"
      aria-label="Tasks are assigned to Collab bots, who work on them at their desks, help each other out and move them to Done"
      className={cn(
        styles.stage,
        "relative mx-auto aspect-[0.66] w-full max-w-5xl md:aspect-[2.6]",
        !layout && "invisible",
        !running && styles.paused
      )}
    >
      {layout && (
        <>
          <Floor layout={layout} />
          <Panel rect={layout.panels.tasks} label="Your tasks" />
          <Panel
            rect={layout.panels.done}
            label="Done"
            count={`${doneCount}/3`}
            complete={doneCount === 3}
          />
          {bots.map((id) => {
            const task = scene.tasks[bots.indexOf(id)]
            return (
              <Monitor
                key={`${id}-${scene.loop}`}
                id={id}
                layout={layout}
                phase={task.phase}
                icon={tasks[bots.indexOf(id)].icon}
                jolt={scene.jolts[id]}
              />
            )
          })}
          {bots.map((id) => (
            <SceneBot key={id} id={id} bot={scene.bots[id]} layout={layout} />
          ))}
          {scene.tasks.map((task, index) => (
            <TaskCard
              key={`${index}-${scene.loop}`}
              index={index as TaskIndex}
              task={task}
              title={tasks[index].title}
              icon={tasks[index].icon}
              scene={scene}
              layout={layout}
            />
          ))}
        </>
      )}
    </div>
  )
}

function Floor({ layout }: { layout: Layout }) {
  const line = (from: FloorPoint, to: FloorPoint) => {
    const a = project(layout, from)
    const b = project(layout, to)
    return { x1: a.x, y1: a.y, x2: b.x, y2: b.y }
  }
  const corners = [
    { u: 0, v: 0 },
    { u: 1, v: 0 },
    { u: 1, v: 1 },
    { u: 0, v: 1 },
  ].map((corner) => {
    const { x, y } = project(layout, corner)
    return `${x},${y}`
  })

  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="absolute inset-0 size-full text-foreground"
    >
      <defs>
        <linearGradient id="bot-scene-floor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon points={corners.join(" ")} fill="url(#bot-scene-floor)" />
      <g stroke="currentColor" strokeOpacity="0.07">
        {[1, 2, 3, 4, 5].map((column) => (
          <line
            key={`u${column}`}
            vectorEffect="non-scaling-stroke"
            {...line({ u: column / 6, v: 0 }, { u: column / 6, v: 1 })}
          />
        ))}
        {[0.25, 0.5, 0.75].map((row) => (
          <line
            key={`v${row}`}
            vectorEffect="non-scaling-stroke"
            {...line({ u: 0, v: row }, { u: 1, v: row })}
          />
        ))}
      </g>
    </svg>
  )
}

function Panel({
  rect,
  label,
  count,
  complete = false,
}: {
  rect: Rect
  label: string
  count?: string
  complete?: boolean
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "absolute rounded-xl border border-dashed bg-card/40 transition-colors duration-500",
        complete && "border-solid border-emerald-500/40 bg-emerald-500/[0.04]"
      )}
      style={{
        left: `${rect.x}%`,
        top: `${rect.y}%`,
        width: `${rect.width}%`,
        height: `${rect.height}%`,
      }}
    >
      <div className="flex items-center justify-between px-3 pt-2 text-[11px] font-medium text-muted-foreground">
        <span>{label}</span>
        {count && (
          <span
            className={cn(
              "tabular-nums transition-colors",
              complete && "text-emerald-500"
            )}
          >
            {count}
          </span>
        )}
      </div>
    </div>
  )
}

function TaskCard({
  index,
  task,
  title,
  icon: Icon,
  scene,
  layout,
}: {
  index: TaskIndex
  task: Task
  title: string
  icon: LucideIcon
  scene: Scene
  layout: Layout
}) {
  const bot = assignee[index]
  let position: Point = layout.queue[index]
  let anchor = "0%"
  let scale = 1
  if (task.slot !== null) {
    position = layout.done[task.slot]
  } else if (task.phase === "working" || task.phase === "stuck") {
    // Hovering over its bot's head while the bot works on it
    const at = project(layout, resolve(layout, scene.bots[bot].spot))
    position = { x: at.x, y: at.y - layout.bot * at.s * 0.9 }
    anchor = "100%"
    scale = layout.card.onBot
  }

  return (
    <div
      aria-hidden
      className={cn(styles.card, task.phase === "cleared" && "opacity-0")}
      style={
        {
          "--x": position.x,
          "--y": position.y,
          "--anchor": anchor,
          "--s": scale,
          width: `${layout.card.width}cqw`,
          zIndex: 300,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(
          "flex items-center gap-2 rounded-lg border bg-popover py-2 text-popover-foreground shadow-sm transition-[border-color,box-shadow] duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1",
          layout.card.compact ? "gap-1 px-2 text-[11px]" : "px-2.5 text-xs",
          task.phase === "assigning" && "border-foreground/40 shadow-md",
          task.phase === "stuck" && "border-destructive/60",
          task.phase === "done" && "border-emerald-500/40"
        )}
      >
        {!layout.card.compact && (
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
        <span className="min-w-0 flex-1 truncate font-medium">{title}</span>
        {task.phase !== "queued" && (
          <span className="flex shrink-0 items-center gap-1 motion-safe:animate-in motion-safe:zoom-in-50">
            {!layout.card.compact && (
              <ChatAvatar seed={seeds[bot]} className="size-4" />
            )}
            {(task.phase === "working" || task.phase === "assigning") && (
              <Spinner className="size-3 text-muted-foreground" />
            )}
            {task.phase === "stuck" && (
              <CircleXIcon className="size-3 text-destructive" />
            )}
            {(task.phase === "done" || task.phase === "cleared") && (
              <CircleCheckIcon className="size-3 text-emerald-500" />
            )}
          </span>
        )}
      </div>
    </div>
  )
}

function SceneBot({
  id,
  bot,
  layout,
}: {
  id: BotId
  bot: Bot
  layout: Layout
}) {
  const point = resolve(layout, bot.spot)
  const { x, y, s } = project(layout, point)

  return (
    <div
      aria-hidden
      className={styles.bot}
      style={
        {
          "--x": x,
          "--y": y,
          "--s": s,
          width: `${layout.bot}cqh`,
          height: `${layout.bot}cqh`,
          transitionDuration: `${bot.walkMs}ms`,
          // Bots nearer the front stand in front
          zIndex: Math.round(point.v * 100) + 10,
        } as React.CSSProperties
      }
    >
      <div
        className={cn(styles.facing, "size-full")}
        style={{ scale: bot.facing === "left" ? "-1 1" : "1 1" }}
      >
        <div
          className={cn(styles.rig, "size-full")}
          data-action={bot.action}
          dangerouslySetInnerHTML={{ __html: riggedBotSvg(seeds[id]) }}
        />
      </div>
    </div>
  )
}

// A desk monitor drawn the way the voxel bots are: a front face, a lit top
// and a shaded side, in the bots' own palette
function Monitor({
  id,
  layout,
  phase,
  icon: Icon,
  jolt,
}: {
  id: BotId
  layout: Layout
  phase: Phase
  icon: LucideIcon
  jolt: number
}) {
  const point = monitorAt(layout, id)
  const { x, y, s } = project(layout, point)
  const busy = phase === "working" || phase === "stuck"
  const finished = phase === "done" || phase === "cleared"

  return (
    <div
      aria-hidden
      className={styles.bot}
      style={
        {
          "--x": x,
          "--y": y,
          "--s": s,
          width: `${layout.monitor}cqh`,
          height: `${layout.monitor}cqh`,
          zIndex: Math.round(point.v * 100) + 10,
        } as React.CSSProperties
      }
    >
      {/* Kicked once a loop at most, so the class alone replays it; a key
          would also restart the progress bar */}
      <div className={cn("relative size-full", jolt > 0 && styles.jolt)}>
        <svg viewBox="0 0 64 64" className="size-full">
          <path d="M10 61h40l8-6.4H18Z" fill="#000" fillOpacity=".08" />
          <path
            d="M16 54h24v4H16Zm0 0h24l8-6.4H24Zm24 0 8-6.4v4l-8 6.4Z"
            fill="#495057"
          />
          <path d="M16 54h24l8-6.4H24Z" fill="#fff" fillOpacity=".38" />
          <path d="m40 54 8-6.4v4l-8 6.4Z" fill="#000" fillOpacity=".24" />
          <path d="M25 40h6v10h-6Zm6 0 3-2.4v10L31 50Z" fill="#343a40" />
          <path
            d="M6 14h44v28H6Zm0 0h44l8-6.4H14Zm44 0 8-6.4v28L50 42Z"
            fill="#495057"
          />
          <path d="M6 14h44l8-6.4H14Z" fill="#fff" fillOpacity=".38" />
          <path d="m50 14 8-6.4v28L50 42Z" fill="#000" fillOpacity=".24" />
          <path d="M9 17h38v22H9Z" fill="#161a21" />
        </svg>
        {/* The screen: what the bot is working on, and how far along */}
        <div className="absolute top-[26.5%] left-[14%] flex h-[34.5%] w-[59.5%] flex-col items-center justify-center gap-[12%] p-[6%]">
          {phase === "stuck" ? (
            <CircleXIcon className="size-[42%] text-[#ff6b6b]" />
          ) : finished ? (
            <CircleCheckIcon className="size-[42%] text-[#69db7c]" />
          ) : (
            <Icon
              className={cn(
                "size-[38%] transition-colors",
                busy ? "text-[#74c0fc]" : "text-white/20"
              )}
            />
          )}
          <div className="h-[9%] w-full overflow-hidden rounded-full bg-white/10">
            {(busy || finished) && (
              <div
                className={cn(
                  styles.fill,
                  "h-full",
                  phase === "stuck"
                    ? cn(styles.stuck, "bg-[#ff6b6b]")
                    : "bg-[#69db7c]",
                  finished && "[animation:none]"
                )}
                style={{ "--work": `${workMs[id]}ms` } as React.CSSProperties}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export { BotScene }
