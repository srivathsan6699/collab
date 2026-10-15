import { parseEnv } from "@neon/env"
import { drizzle } from "drizzle-orm/node-postgres"
import { Pool } from "pg"

import config from "@/neon"
import * as schema from "./schema"

const { postgres } = parseEnv(config, ["DATABASE_URL"])

// Reuse the pool across hot reloads in dev
const globalForDb = globalThis as unknown as { pool?: Pool }
const pool =
  globalForDb.pool ?? new Pool({ connectionString: postgres.databaseUrl })
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool

// No server-only guard, so Trigger.dev tasks can use it too.
// Next.js code imports @/lib/db, which keeps the guard
export const db = drizzle({ client: pool, schema })
