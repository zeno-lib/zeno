# `@zeno-lib/db` — Intent

Drizzle ORM wrapper for the Supabase Postgres database. Three source files: a client module (admin + RLS getters), a `drizzle-kit` config preset, and shared schema primitives. This package owns the database; `@zeno-lib/supabase` owns auth, storage, and the SSR client.

## Purpose & Scope

Provides a Drizzle-based interface for everything DB-related against Supabase Postgres: paired admin/RLS clients, a `drizzle-kit` config preset pre-tuned for Supabase, and re-exports of `drizzle-orm/supabase` roles, tables, and helpers.

**Owns:** schema (TS source of truth), migrations (`drizzle-kit generate`/`migrate`), RLS roles & policies (authored via `pgPolicy(...)` in schema files), typed runtime queries, the `postgres-js` connections.

**Does NOT own:** Supabase Auth, Storage, Edge Functions, the SSR cookie wiring (all in `@zeno-lib/supabase`). Browser-side data access — `postgres-js` is server-only; the browser still talks to Supabase via `postgrest` / `supabase-js`.

## Entry Points & Contracts

| Import | Use from | Returns / does |
|---|---|---|
| `@zeno-lib/db/clients` | Server code (Server Components, Route Handlers, Server Actions, cron, scripts) | `createDrizzleClients({ schema, connectionString?, casing? })` → `{ getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient, closeDrizzleSupabaseClients }`. Opens two `postgres-js` pools. `getDrizzleSupabaseAdminClient()` returns a Drizzle db that **bypasses RLS**. `getDrizzleSupabaseClient(verifiedClaims?)` accepts already-verified Supabase JWT claims and returns `{ runTransaction }` — every query MUST run inside `runTransaction` for the JWT context (and thus RLS) to apply. `closeDrizzleSupabaseClients()` closes both pools for tests/scripts/shutdown. |
| `@zeno-lib/db/config` | `drizzle.config.ts` in each consuming package/app | `defineDrizzleConfig({ schema, ...overrides })` — preset that defaults `out` to `./supabase/migrations`, dialect to `postgresql`, reads `DATABASE_URL` from env, and sets `entities.roles.provider: "supabase"`. |
| `@zeno-lib/db/schema` | Application schema files | Re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`. Plus a local `timestamps` mixin (`createdAt`, `updatedAt`). |

`createDrizzleClients` reads `DATABASE_URL` from `process.env` with an optional `{ connectionString }` override; throws `"Missing DATABASE_URL environment variable"` if neither resolves. Both pools pass `prepare: false` to `postgres-js` so the Supabase transaction pooler (port 6543) works. The RLS path expects verified JWT claims and validates the `role` against `anon | authenticated` (default `anon`) before `set local role`; use the admin client for service-role work.

## Usage Patterns

Create the pools once at module scope:

```ts
// db.ts
import { createDrizzleClients } from "@zeno-lib/db/clients"
import * as schema from "./schema"

export const { getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient } =
  createDrizzleClients({ schema })
```

Admin (bypasses RLS — webhooks, admin tasks, background jobs, seeding):

```ts
import { getDrizzleSupabaseAdminClient } from "./db"
import { posts } from "./schema"

const db = getDrizzleSupabaseAdminClient()
await db.select().from(posts) // RLS bypassed
```

RLS-aware per request — verify the request's token first, then pass the verified claims; queries run inside `runTransaction`:

```ts
// route.ts
import { createClient } from "@zeno-lib/supabase/server"
import { getDrizzleSupabaseClient } from "./db"
import { posts } from "./schema"

const supabase = await createClient()
const { data, error } = await supabase.auth.getClaims()
if (error) throw error
const { runTransaction } = getDrizzleSupabaseClient(data.claims)

const mine = await runTransaction((tx) => tx.select().from(posts)) // RLS enforced
```

Schema with an RLS policy:

```ts
// schema.ts
import { sql } from "drizzle-orm"
import { pgPolicy, pgTable, text, uuid } from "drizzle-orm/pg-core"
import { authUid, authUsers, authenticatedRole, timestamps } from "@zeno-lib/db/schema"

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => authUsers.id),
    title: text("title").notNull(),
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

`drizzle.config.ts`:

```ts
import { defineDrizzleConfig } from "@zeno-lib/db/config"
export default defineDrizzleConfig({ schema: "./src/schema.ts" })
```

## Anti-patterns

- **Do not import `@zeno-lib/db/clients` from a Client Component.** `postgres-js` opens a TCP socket — server-only. Browser code talks to Supabase via REST (`@supabase/supabase-js`) or via your own Server Actions/Route Handlers.
- **Do not run queries outside `runTransaction` when you intend RLS to apply.** A query on the admin client (or anything outside the `runTransaction` block) executes as the connection role, bypassing the policies you authored. The JWT claims + role are only set inside that transaction.
- **Do not pass raw JWT strings or unverified session payloads into `getDrizzleSupabaseClient`.** Verify first with Supabase Auth (`auth.getClaims()` / equivalent) and pass the resulting claims object. The DB package deliberately does not decode or verify tokens.
- **Do not write RLS policies as raw SQL in `supabase/migrations/` by hand.** `pgPolicy(...)` in the schema is the source of truth — drizzle-kit emits `CREATE POLICY` SQL during `generate`. A hand-written policy file will desync from the schema and won't survive the next `drizzle-kit generate`.
- **Do not declare the Supabase-built-in roles (`anon`, `authenticated`, `service_role`, `postgres_role`, `supabase_auth_admin`).** They're pre-existing in every Supabase project. Reference them via the `.existing()` exports from `@zeno-lib/db/schema`.
- **Do not omit `prepare: false`** if you ever construct your own `postgres-js` client against a Supabase pooler URL — prepared statements aren't supported in transaction-mode pooling and queries fail at runtime.
- **Do not call `createDrizzleClients()` per request.** Each call opens two new connection pools. Call it once at module scope and reuse the returned getters.
- **Do not interpolate an unvalidated `role` into `set local role`.** `getDrizzleSupabaseClient` only accepts `anon | authenticated` (defaulting to `anon`) before interpolating, so a forged `role` claim can't inject SQL or switch into `service_role`. Keep that allowlist if you fork the file.

## Dependencies & Edges

Peer: `drizzle-orm >=0.44`, `drizzle-kit >=0.31`, `postgres >=3.4`. No workspace runtime deps. JWT verification belongs to the consumer's Supabase Auth layer; `clients.ts` only receives verified claims and installs them into the transaction-local Postgres settings used by `auth.uid()` / `auth.jwt()`. Env loading (e.g. `dotenv/config`) is the consumer's responsibility — `drizzle.config.ts` should `import "dotenv/config"` at the top when run outside a framework that auto-loads `.env` (Next.js).

Used by: any package or app that needs to read/write Supabase Postgres with typed schemas. Reads no other `@zeno-lib/*` package.

Coexists with `@zeno-lib/supabase`: consumers typically import `createClient` from `@zeno-lib/supabase/server` for auth (and the `access_token`) and import `createDrizzleClients` from this package for data.

## Pitfalls

- **`drizzle-kit migrate` tracks state in `__drizzle_migrations`, not by file name.** Pre-existing `.sql` files in `supabase/migrations/` that weren't produced by `drizzle-kit generate` are ignored by `drizzle-kit migrate`. `npx supabase db reset`, however, applies *every* file in the directory alphabetically — so mixing hand-written SQL with drizzle-generated SQL works for resets but not for incremental migration tracking.
- **`DATABASE_URL` should use the transaction pooler (port 6543) in production**; local Supabase uses the direct port `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. `prepare: false` is already set so the pooler works.
- **`casing` must match between runtime and migrations.** `createDrizzleClients` passes `casing` through (default: column names = schema keys verbatim). If you set `casing: "snake_case"`, also set it in `drizzle.config.ts` and regenerate migrations, or the runtime column names won't match the DB.
- **Forgetting `entities.roles.provider: "supabase"`** would make drizzle-kit try to drop Supabase's built-in roles in the next migration. The shared `defineDrizzleConfig` sets this by default — don't override `entities` without re-merging this flag.
- **`getDrizzleSupabaseClient` expects verified Supabase JWT claims, not the raw `access_token`.** It sets `request.jwt.claims` to the claims JSON + `request.jwt.claim.sub`, so `auth.uid()` resolves. Passing a raw token string, missing claims, or an unallowed role yields the `anon` role.
- **`request.jwt.claims` is set via `set_config(..., true)`** (transaction-local), so it auto-resets at commit/rollback. Run each request's queries inside its own `runTransaction` so the context never leaks across requests.
- **`scripts` has only `types:check`** — no build, no test. Add scripts if/when the surface grows.
