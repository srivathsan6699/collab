"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import { createGroupChat } from "@/actions/group-chat"
import { ChatAvatar } from "@/components/chat-avatar"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import { insertGroupChatSchema, type InsertGroupChat } from "@/lib/db/schema"
import type { BotListItem } from "@/queries/bot"

function GroupChatDialog({
  bots,
  open,
  onOpenChange,
}: {
  bots: BotListItem[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(open) => onOpenChange(open)}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New group chat</DialogTitle>
          <DialogDescription>
            Name the group and pick which bots are in it.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each open starts with a fresh form */}
        <GroupChatForm bots={bots} onCreated={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GroupChatForm({
  bots,
  onCreated,
}: {
  bots: BotListItem[]
  onCreated: () => void
}) {
  const router = useRouter()
  const form = useForm<InsertGroupChat>({
    resolver: zodResolver(insertGroupChatSchema),
    defaultValues: { name: "", botIds: [] },
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: InsertGroupChat) {
    const result = await createGroupChat(values)

    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof InsertGroupChat, { message: messages?.[0] })
      }
      toast.add({
        type: "error",
        title: "Couldn't create group",
        description: result.error,
      })
      return
    }

    toast.add({ type: "success", title: `${values.name} is ready` })
    onCreated()
    router.push(`/chats/${result.id}`)
  }

  return (
    <>
      <form id="group-chat-form" onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup>
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="group-chat-name">Name</FieldLabel>
                <Input
                  {...field}
                  value={field.value ?? ""}
                  id="group-chat-name"
                  placeholder="Weekend plans"
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
            name="botIds"
            control={form.control}
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend variant="label">Bots</FieldLegend>
                <FieldGroup data-slot="checkbox-group" className="gap-3">
                  {bots.map((bot) => (
                    <Field key={bot.id} orientation="horizontal">
                      <Checkbox
                        id={`group-chat-bot-${bot.id}`}
                        name={field.name}
                        checked={field.value.includes(bot.id)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...field.value, bot.id]
                              : field.value.filter((id) => id !== bot.id)
                          )
                        }
                        aria-invalid={fieldState.invalid}
                      />
                      <FieldLabel
                        htmlFor={`group-chat-bot-${bot.id}`}
                        className="font-normal"
                      >
                        <ChatAvatar seed={bot.avatar} className="size-5" />
                        {bot.name}
                      </FieldLabel>
                    </Field>
                  ))}
                </FieldGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </FieldSet>
            )}
          />
        </FieldGroup>
      </form>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" form="group-chat-form" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          Create group
        </Button>
      </DialogFooter>
    </>
  )
}

export { GroupChatDialog }
