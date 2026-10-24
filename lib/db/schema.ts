import { relations } from "drizzle-orm"
import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { createInsertSchema, createUpdateSchema } from "drizzle-zod"
import { nanoid } from "nanoid"
import { z } from "zod"

export const bots = pgTable(
  "bots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(), // Clerk user ID
    name: text("name").notNull(),
    avatar: text("avatar")
      .notNull()
      .$defaultFn(() => nanoid()), // Seed for the bot's face
    job: text("job").notNull(), // What the bot is for, in a phrase
    instructions: text("instructions"), // How it should go about the job
    sandboxId: text("sandbox_id").notNull(), // Daytona sandbox, created with the bot
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("bots_user_id_idx").on(t.userId)]
)

// What a user can set when creating a bot; userId comes from the session
export const insertBotSchema = createInsertSchema(bots, {
  name: (s) => s.trim().min(1, "Give your bot a name.").max(50),
  avatar: (s) => s.min(1),
  job: (s) => s.trim().min(1, "Tell your bot what its job is.").max(100),
  instructions: (s) => s.trim().max(2000),
})
  .pick({ name: true, avatar: true, job: true, instructions: true })
  .required({ avatar: true })

export type InsertBot = z.infer<typeof insertBotSchema>

// The same fields when editing a bot; the form always sends all of them
export const updateBotSchema = createUpdateSchema(bots, {
  name: (s) => s.trim().min(1, "Give your bot a name.").max(50),
  avatar: (s) => s.min(1),
  job: (s) => s.trim().min(1, "Tell your bot what its job is.").max(100),
  instructions: (s) => s.trim().max(2000),
})
  .pick({ name: true, avatar: true, job: true, instructions: true })
  .required()

export type UpdateBot = z.infer<typeof updateBotSchema>

export const chatKind = pgEnum("chat_kind", ["direct", "group"])

export const chats = pgTable(
  "chats",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(), // Clerk user ID
    kind: chatKind("kind").notNull().default("direct"),
    name: text("name"), // Null for direct chats, which use the bot's name
    lastMessagePreview: text("last_message_preview"),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("chats_user_id_idx").on(t.userId)]
)

// What a user can set when creating a group chat; the bots become its members
export const insertGroupChatSchema = createInsertSchema(chats, {
  name: (s) => s.trim().min(1, "Give the group a name.").max(50),
})
  .pick({ name: true })
  .required({ name: true })
  .extend({
    botIds: z.array(z.string()).min(2, "Pick at least two bots."),
  })

export type InsertGroupChat = z.infer<typeof insertGroupChatSchema>

// The same fields when editing a group chat; botIds replaces its members
export const updateGroupChatSchema = createUpdateSchema(chats, {
  name: (s) => s.trim().min(1, "Give the group a name.").max(50),
})
  .pick({ name: true })
  .required({ name: true })
  .extend({
    botIds: z.array(z.string()).min(2, "Pick at least two bots."),
  })

export type UpdateGroupChat = z.infer<typeof updateGroupChatSchema>

export const chatMembers = pgTable(
  "chat_members",
  {
    chatId: text("chat_id")
      .notNull()
      .references(() => chats.id, { onDelete: "cascade" }),
    botId: text("bot_id")
      .notNull()
      .references(() => bots.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.chatId, t.botId] }),
    index("chat_members_bot_id_idx").on(t.botId),
  ]
)

export const usageKind = pgEnum("usage_kind", ["ai", "sandbox"])

// The usage ledger: one row per charge against a user's plan allowance.
// Rows are only ever inserted; usage in a period is the sum of its rows
export const usageEvents = pgTable(
  "usage_events",
  {
    // Deterministic where a charge could be recorded twice, like a sandbox
    // meter tick that retries, so the insert can skip duplicates
    id: text("id")
      .primaryKey()
      .$defaultFn(() => nanoid()),
    userId: text("user_id").notNull(), // Clerk user ID
    kind: usageKind("kind").notNull(),
    // Tokens for ai, running seconds for sandbox
    quantity: integer("quantity").notNull(),
    // What it cost us, in millionths of a dollar
    costMicros: integer("cost_micros").notNull(),
    // Where it came from: the chat, bot, sandbox, and the token breakdown
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("usage_events_user_period_idx").on(t.userId, t.createdAt)]
)

export const botsRelations = relations(bots, ({ many }) => ({
  memberships: many(chatMembers),
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  members: many(chatMembers),
}))

export const chatMembersRelations = relations(chatMembers, ({ one }) => ({
  chat: one(chats, { fields: [chatMembers.chatId], references: [chats.id] }),
  bot: one(bots, { fields: [chatMembers.botId], references: [bots.id] }),
}))
