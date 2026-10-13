"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ShuffleIcon } from "lucide-react"
import { nanoid } from "nanoid"
import { Controller, useForm, useWatch } from "react-hook-form"

import { createBot } from "@/actions/bot"
import { ChatAvatar } from "@/components/chat-avatar"
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
import { insertBotSchema, type InsertBot } from "@/lib/db/schema"

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

function BotDialog({ trigger }: { trigger: React.ReactElement }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New bot</DialogTitle>
          <DialogDescription>
            Give it a face, a name, and a job to do.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each open starts with a fresh form */}
        <BotForm onCreated={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function BotForm({ onCreated }: { onCreated: () => void }) {
  const form = useForm<InsertBot>({
    resolver: zodResolver(insertBotSchema),
    defaultValues: { name: "", avatar: nanoid(), job: "", instructions: "" },
  })
  const avatar = useWatch({ control: form.control, name: "avatar" })
  const { isSubmitting } = form.formState

  async function onSubmit(values: InsertBot) {
    const result = await createBot(values)

    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof InsertBot, { message: messages?.[0] })
      }
      toast.add({
        type: "error",
        title: "Couldn't create bot",
        description: result.error,
      })
      return
    }

    toast.add({ type: "success", title: `${values.name} is ready` })
    onCreated()
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
            <ChatAvatar seed={avatar} className="size-12 rounded-none" />
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
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" form="bot-form" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Create bot
        </Button>
      </DialogFooter>
    </>
  )
}

export { BotDialog }
