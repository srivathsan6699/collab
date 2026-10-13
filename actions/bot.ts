"use server"

import { auth } from "@clerk/nextjs/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/db"
import { bots, insertBotSchema, type InsertBot } from "@/lib/db/schema"

type CreateBotResult =
  | { ok: true; id: string }
  | {
      ok: false
      error: string
      fieldErrors?: Partial<Record<keyof InsertBot, string[]>>
    }

export async function createBot(input: InsertBot): Promise<CreateBotResult> {
  const { isAuthenticated, userId } = await auth()
  if (!isAuthenticated)
    return { ok: false, error: "You need to sign in first." }

  const parsed = insertBotSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: "Check the highlighted fields.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    }
  }

  const { instructions, ...values } = parsed.data
  const [bot] = await db
    .insert(bots)
    .values({ ...values, instructions: instructions || null, userId })
    .returning({ id: bots.id })

  revalidatePath("/")
  return { ok: true, id: bot.id }
}
