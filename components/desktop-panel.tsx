"use client"

import { cn } from "cn"
import { MonitorIcon, RefreshCwIcon } from "lucide-react"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

import { getDesktopUrl } from "@/actions/desktop"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"

type Desktop =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; url: string }
  | { status: "error"; error: string }

const DesktopPanelContext = createContext<{
  open: boolean
  toggle: () => void
  desktop: Desktop
  connect: () => Promise<void>
  setPanelSlot: (slot: HTMLElement | null) => void
  setDialogSlot: (slot: HTMLElement | null) => void
} | null>(null)

function useDesktopPanel() {
  const context = useContext(DesktopPanelContext)
  if (!context) {
    throw new Error("useDesktopPanel must be used within DesktopPanelProvider")
  }
  return context
}

function DesktopPanelProvider({
  chatId,
  children,
}: {
  chatId: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [desktop, setDesktop] = useState<Desktop>({ status: "idle" })
  // Where the viewer currently shows: the panel's preview or the dialog
  const [panelSlot, setPanelSlot] = useState<HTMLElement | null>(null)
  const [dialogSlot, setDialogSlot] = useState<HTMLElement | null>(null)

  async function connect() {
    setDesktop({ status: "loading" })
    try {
      const result = await getDesktopUrl(chatId)
      setDesktop(
        result.ok
          ? { status: "ready", url: result.url }
          : { status: "error", error: result.error }
      )
    } catch {
      setDesktop({ status: "error", error: "Couldn't reach the desktop." })
    }
  }

  function toggle() {
    setOpen(!open)
    // Connect on first open. The viewer stays loaded while the panel is closed
    if (desktop.status === "idle") void connect()
  }

  return (
    <DesktopPanelContext
      value={{ open, toggle, desktop, connect, setPanelSlot, setDialogSlot }}
    >
      {children}
      {desktop.status === "ready" && (
        <DesktopViewer
          url={desktop.url}
          slot={dialogSlot ?? (open ? panelSlot : null)}
          interactive={dialogSlot !== null}
        />
      )}
    </DesktopPanelContext>
  )
}

// The one VNC iframe. Moving an iframe in the DOM reloads it, so it lives in
// a fixed layer on <body> and follows whichever slot is showing it, instead of
// being rendered inside the panel and the dialog.
function DesktopViewer({
  url,
  slot,
  interactive,
}: {
  url: string
  slot: HTMLElement | null
  interactive: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const viewer = ref.current
    if (!viewer) return
    if (!slot) {
      viewer.style.visibility = "hidden"
      return
    }

    // Track every frame so panel resizes and the dialog's zoom stay in sync
    let frame: number
    const follow = () => {
      const { top, left, width, height } = slot.getBoundingClientRect()
      Object.assign(viewer.style, {
        visibility: "visible",
        top: `${top}px`,
        left: `${left}px`,
        width: `${width}px`,
        height: `${height}px`,
      })
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(frame)
  }, [slot])

  return createPortal(
    <div
      ref={ref}
      className={cn(
        "invisible fixed overflow-hidden rounded-lg",
        // Above the dialog popup when fullscreen. In the panel, clicks pass
        // through to the preview button underneath
        interactive ? "z-51" : "pointer-events-none"
      )}
    >
      <iframe
        src={url}
        title="Desktop"
        allow="clipboard-read; clipboard-write"
        className="size-full border-0"
      />
    </div>,
    document.body
  )
}

function DesktopSlot({
  ref,
  className,
}: {
  ref: (slot: HTMLElement | null) => void
  className?: string
}) {
  const { desktop } = useDesktopPanel()

  return (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-center rounded-lg bg-muted p-4 text-sm text-muted-foreground",
        className
      )}
    >
      {desktop.status === "loading" && <Spinner />}
      {desktop.status === "error" && desktop.error}
    </div>
  )
}

function DesktopPanelTrigger() {
  const { open, toggle } = useDesktopPanel()

  return (
    <Button
      variant={open ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label="Desktop"
      aria-pressed={open}
      onClick={toggle}
    >
      <MonitorIcon />
    </Button>
  )
}

// Renders its children (the handle and panel) only while the panel is open.
function DesktopPanel({ children }: { children: React.ReactNode }) {
  const { open } = useDesktopPanel()

  return open ? children : null
}

function DesktopPreview({ name }: { name: string }) {
  const { desktop, connect, setPanelSlot, setDialogSlot } = useDesktopPanel()
  const [fullscreen, setFullscreen] = useState(false)
  const title = `${name}'s screen`

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Reconnect"
          disabled={desktop.status === "loading"}
          onClick={() => void connect()}
        >
          <RefreshCwIcon />
        </Button>
      </div>
      {/* Non-modal so the viewer layered over the popup can take focus and
          input. Only the close button closes it: keys and clicks meant for
          the desktop must never dismiss it */}
      <Dialog
        open={fullscreen}
        onOpenChange={(open, { reason }) => {
          if (open || reason === "close-press") setFullscreen(open)
        }}
        modal={false}
        disablePointerDismissal
      >
        <DialogTrigger
          aria-label={`Open ${title} in fullscreen`}
          className="aspect-4/3 w-full cursor-zoom-in rounded-xl border bg-card p-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <DesktopSlot ref={setPanelSlot} className="size-full" />
        </DialogTrigger>
        <DialogContent className="flex h-[calc(100svh-2rem)] flex-col sm:max-w-[calc(100%-2rem)]">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <DesktopSlot ref={setDialogSlot} className="min-h-0 flex-1" />
        </DialogContent>
      </Dialog>
      <p className="text-center text-sm text-muted-foreground">{title}</p>
    </div>
  )
}

export {
  DesktopPanel,
  DesktopPanelProvider,
  DesktopPanelTrigger,
  DesktopPreview,
}
