"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShuffleIcon, Trash2Icon } from "lucide-react"
import { nanoid } from "nanoid"
import { usePathname, useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"

import { createBot, deleteBot, updateBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/toast"
import { useUpgrade } from "@/components/upgrade-toast"
import { BOT_FEATURES, UPGRADE_REQUIRED } from "@/lib/billing"
import {
  insertBotSchema,
  updateBotSchema,
  type InsertBot,
} from "@/lib/db/schema"

// An existing bot to edit; without one the dialog creates a new bot
type EditableBot = InsertBot & { id: string }

const presets = [
  {
    job: "Research assistant",
    instructions:
      "Answer briefly, cite sources, and ask before running anything destructive.",
  },
  {
    job: "Code reviewer",
    instructions:
      "Look for bugs before style. Point to exact lines and suggest a fix for each issue.",
  },
  {
    job: "Writing editor",
    instructions:
      "Tighten the prose without changing the author's voice, and explain any big edit.",
  },
  {
    job: "Tutor",
    instructions:
      "Teach one step at a time and check understanding with a question before moving on.",
  },
]

function BotDialog({
  bot,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  bot?: EditableBot
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const { requireFeatures } = useUpgrade()

  return (
    <Dialog
      open={open}
      onOpenChange={(open) => {
        // Editing is free; a new bot needs a plan that includes bots
        if (open && !bot && !requireFeatures(BOT_FEATURES, "Can't create bot"))
          return
        setOpen(open)
      }}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{bot ? `Edit ${bot.name}` : "Build a bot"}</DialogTitle>
          <DialogDescription>
            {bot
              ? "Change its face, name, or job."
              : "Pick a face, a name, and a job to do."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each open starts with a fresh form */}
        <BotForm bot={bot} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function BotForm({ bot, onSaved }: { bot?: EditableBot; onSaved: () => void }) {
  const form = useForm<InsertBot>({
    resolver: zodResolver(bot ? updateBotSchema : insertBotSchema),
    defaultValues: bot
      ? {
          name: bot.name,
          avatar: bot.avatar,
          job: bot.job,
          instructions: bot.instructions ?? "",
        }
      : { name: "", avatar: nanoid(), job: "", instructions: "" },
  })
  const avatar = useWatch({ control: form.control, name: "avatar" })
  const name = useWatch({ control: form.control, name: "name" }).trim()
  const { isSubmitting } = form.formState
  const { showUpgradeToast } = useUpgrade()

  async function onSubmit(values: InsertBot) {
    const result = bot
      ? await updateBot(bot.id, values)
      : await createBot(values)

    if (!result.ok && "code" in result && result.code === UPGRADE_REQUIRED) {
      showUpgradeToast("Couldn't create bot")
      return
    }
    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof InsertBot, { message: messages?.[0] })
      }
      toast.add({
        type: "error",
        title: bot ? "Couldn't save changes" : "Couldn't create bot",
        description: result.error,
      })
      return
    }

    toast.add({
      type: "success",
      title: bot ? `${values.name} is updated` : `${values.name} is ready`,
    })
    onSaved()
  }

  return (
    <>
      <form id="bot-form" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <Button
                key={preset.job}
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  form.setValue("job", preset.job, { shouldValidate: true })
                  form.setValue("instructions", preset.instructions)
                }}
              >
                {preset.job}
              </Button>
            ))}
          </div>

          <Field orientation="horizontal">
            <ChatAvatar seed={avatar} className="size-12" />
            <FieldContent>
              <FieldTitle>Face</FieldTitle>
              <FieldDescription>
                Shuffle until you find one you like.
              </FieldDescription>
            </FieldContent>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => form.setValue("avatar", nanoid())}
            >
              <ShuffleIcon data-icon="inline-start" />
              Shuffle
            </Button>
          </Field>

          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="bot-name">Name</FieldLabel>
                <Input
                  {...field}
                  id="bot-name"
                  placeholder="Ada"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="job"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="bot-job">Job</FieldLabel>
                <Input
                  {...field}
                  id="bot-job"
                  placeholder="Research assistant"
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Controller
            name="instructions"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="bot-instructions">
                  How it should work
                </FieldLabel>
                <Textarea
                  {...field}
                  value={field.value ?? ""}
                  id="bot-instructions"
                  placeholder="Answer briefly, cite sources, and ask before running anything destructive."
                  className="min-h-24"
                  aria-invalid={fieldState.invalid}
                />
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        {bot && <DeleteBotButton bot={bot} onDeleted={onSaved} />}
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" form="bot-form" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {bot ? "Save changes" : name ? `Bring ${name} to life` : "Create bot"}
        </Button>
      </DialogFooter>
    </>
  )
}

function DeleteBotButton({
  bot,
  onDeleted,
}: {
  bot: EditableBot
  onDeleted: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isDeleting, setIsDeleting] = React.useState(false)

  async function onDelete() {
    setIsDeleting(true)
    const result = await deleteBot(bot.id)
    setIsDeleting(false)

    if (!result.ok) {
      toast.add({
        type: "error",
        title: "Couldn't delete bot",
        description: result.error,
      })
      return
    }

    toast.add({ type: "success", title: `${bot.name} is deleted` })
    // The chat being viewed may have gone with the bot
    if (result.chatIds.some((id) => pathname === `/chats/${id}`)) {
      router.replace("/")
    }
    onDeleted()
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={
          <Button type="button" variant="destructive" className="sm:mr-auto" />
        }
      >
        <Trash2Icon data-icon="inline-start" />
        Delete
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {bot.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the bot and its direct chats. You can&apos;t undo this.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting && <Spinner data-icon="inline-start" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { BotDialog }
