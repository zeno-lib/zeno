# @zeno-lib/db

Drizzle helpers for Supabase Postgres: one admin client for trusted server work,
one RLS-safe path for request-scoped queries, plus a Drizzle Kit config preset
that avoids fighting Supabase's built-in roles.

## Install

```sh
pnpm add @zeno-lib/db drizzle-orm postgres
pnpm add -D drizzle-kit
```

## 1. Define your schema

```ts
// src/schema.ts
import { sql } from "drizzle-orm"
import { pgPolicy, pgTable, text, uuid } from "drizzle-orm/pg-core"
import {
  authenticatedRole,
  authUid,
  authUsers,
  timestamps,
} from "@zeno-lib/db/schema"

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id),
    ...timestamps,
  },
  (t) => [
    pgPolicy("posts_owner_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
  ]
).enableRLS()
```

## 2. Create the database helper

```ts
// src/db.ts
import { createSupabaseDrizzle } from "@zeno-lib/db"
import * as schema from "./schema"

export const db = createSupabaseDrizzle({ schema })
```

Create this once at module scope so the Postgres pools are reused.

## 3. Query with RLS

If your Supabase client is request-scoped, bind it at the call site:

```ts
// route.ts
import { createClient } from "@zeno-lib/supabase/server"
import { db } from "./db"
import { posts } from "./schema"

const supabase = await createClient()

const mine = await db.withAuth(supabase).rls((tx) =>
  tx.select().from(posts)
)
```

If your module already has the correct request-scoped Supabase client, you can
bind it up front:

```ts
const supabase = await createClient()
const db = createSupabaseDrizzle({ schema, supabase })

const mine = await db.rls((tx) => tx.select().from(posts))
```

`db.rls(...)` calls `supabase.auth.getClaims()` before the transaction. Those
claims are the verified JWT payload Supabase returns after validating the
current access token. The package installs them into transaction-local Postgres
settings so Supabase helpers like `auth.uid()` and `auth.jwt()` work inside RLS
policies.

## Admin queries

```ts
await db.admin.select().from(posts)
```

`db.admin` bypasses RLS. Use it only for trusted server work: webhooks, cron,
admin jobs, and seed scripts.

## Drizzle Kit config

```ts
// drizzle.config.ts
import "dotenv/config"
import { defineDrizzleConfig } from "@zeno-lib/db/config"

export default defineDrizzleConfig()
```

The preset defaults to:

- `schema: "./src/schema.ts"`
- `out: "./supabase/migrations"`
- `dialect: "postgresql"`
- `dbCredentials.url: process.env.DATABASE_URL`
- `entities.roles.provider: "supabase"`

## Local workflow

For local Supabase:

```env
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

Recommended scripts:

```json
{
  "scripts": {
    "dev": "pnpm exec supabase start",
    "stop": "pnpm exec supabase stop",
    "reset": "pnpm exec supabase db reset && pnpm db:seed",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "node src/seed.ts"
  }
}
```

Use one migration source of truth: author tables and RLS policies in your
Drizzle schema, run `drizzle-kit generate`, and commit the generated SQL under
`supabase/migrations`.

## Common pitfalls

- Do not pass raw JWT strings to RLS helpers. Pass a Supabase client, or
  already-verified claims from `supabase.auth.getClaims()`.
- Do not use `service_role` through `db.rls`; use `db.admin` for service-role
  work.
- Do not create the database helper per request unless your Supabase client must
  be bound at construction time. Prefer `db.withAuth(supabase).rls(...)` when
  only auth context is request-scoped.
- Do not mix hand-written RLS migrations with Drizzle-authored policies unless
  you are intentionally taking ownership of the desync risk.
- Keep `casing` consistent between `createSupabaseDrizzle(...)` and
  `defineDrizzleConfig(...)`.
