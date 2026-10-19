"use client"

import * as React from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Trash2Icon } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"

import {
  createGroupChat,
  deleteGroupChat,
  updateGroupChat,
} from "@/actions/group-chat"
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
import { Checkbox } from "@/components/ui/checkbox"
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
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { toast } from "@/components/ui/toast"
import {
  insertGroupChatSchema,
  updateGroupChatSchema,
  type InsertGroupChat,
} from "@/lib/db/schema"
import type { BotListItem } from "@/queries/bot"

// An existing group chat to edit; without one the dialog creates a new group
type EditableGroupChat = InsertGroupChat & { id: string }

function GroupChatDialog({
  bots,
  chat,
  trigger,
  open: openProp,
  onOpenChange,
}: {
  bots: BotListItem[]
  chat?: EditableGroupChat
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  return (
    <Dialog open={open} onOpenChange={(open) => setOpen(open)}>
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {chat ? `Edit ${chat.name}` : "New group chat"}
          </DialogTitle>
          <DialogDescription>
            {chat
              ? "Rename the group or change which bots are in it."
              : "Name the group and pick which bots are in it."}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so each open starts with a fresh form */}
        <GroupChatForm bots={bots} chat={chat} onSaved={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}

function GroupChatForm({
  bots,
  chat,
  onSaved,
}: {
  bots: BotListItem[]
  chat?: EditableGroupChat
  onSaved: () => void
}) {
  const router = useRouter()
  const form = useForm<InsertGroupChat>({
    resolver: zodResolver(chat ? updateGroupChatSchema : insertGroupChatSchema),
    defaultValues: chat
      ? { name: chat.name, botIds: chat.botIds }
      : { name: "", botIds: [] },
  })
  const { isSubmitting } = form.formState

  async function onSubmit(values: InsertGroupChat) {
    const result = chat
      ? await updateGroupChat(chat.id, values)
      : await createGroupChat(values)

    if (!result.ok) {
      for (const [name, messages] of Object.entries(result.fieldErrors ?? {})) {
        form.setError(name as keyof InsertGroupChat, { message: messages?.[0] })
      }
      toast.add({
        type: "error",
        title: chat ? "Couldn't save changes" : "Couldn't create group",
        description: result.error,
      })
      return
    }

    toast.add({
      type: "success",
      title: chat ? `${values.name} is updated` : `${values.name} is ready`,
    })
    onSaved()
    if ("id" in result) router.push(`/chats/${result.id}`)
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
        {chat && <DeleteGroupChatButton chat={chat} onDeleted={onSaved} />}
        <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
        <Button type="submit" form="group-chat-form" disabled={isSubmitting}>
          {isSubmitting && <Spinner data-icon="inline-start" />}
          {chat ? "Save changes" : "Create group"}
        </Button>
      </DialogFooter>
    </>
  )
}

function DeleteGroupChatButton({
  chat,
  onDeleted,
}: {
  chat: EditableGroupChat
  onDeleted: () => void
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isDeleting, setIsDeleting] = React.useState(false)

  async function onDelete() {
    setIsDeleting(true)
    const result = await deleteGroupChat(chat.id)
    setIsDeleting(false)

    if (!result.ok) {
      toast.add({
        type: "error",
        title: "Couldn't delete group",
        description: result.error,
      })
      return
    }

    toast.add({ type: "success", title: `${chat.name} is deleted` })
    if (pathname === `/chats/${chat.id}`) router.replace("/")
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
          <AlertDialogTitle>Delete {chat.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This deletes the group chat, but not its bots. You can&apos;t undo
            this.
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

export { GroupChatDialog }
