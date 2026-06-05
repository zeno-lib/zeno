# `@zeno-lib/db` — Intent

Drizzle ORM wrapper for the Supabase Postgres database. Source files cover the root package entrypoint, client helpers (admin + RLS), a `drizzle-kit` config preset, shared schema primitives, and Drizzle/Postgres re-export shims. This package owns the database; `@zeno-lib/supabase` owns auth, storage, and the SSR client.

## Purpose & Scope

Provides a Drizzle-based interface for everything DB-related against Supabase Postgres: paired admin/RLS clients, a `drizzle-kit` config preset pre-tuned for Supabase, re-exports of the Drizzle APIs consumers need, and re-exports of `drizzle-orm/supabase` roles, tables, and helpers.

**Owns:** schema (TS source of truth), migrations (`drizzle-kit generate`/`migrate`), RLS roles & policies (authored via `pgPolicy(...)` in schema files), typed runtime queries, the `postgres-js` connections.

**Does NOT own:** Supabase Auth, Storage, Edge Functions, the SSR cookie wiring (all in `@zeno-lib/supabase`). Browser-side Supabase features such as realtime — `postgres-js` is server-only, and normal application reads/writes should go through backend entry points that use this package rather than direct browser table queries.

## Entry Points & Contracts

| Import | Use from | Returns / does |
|---|---|---|
| `@zeno-lib/db` | Server code (Server Components, Route Handlers, Server Actions, cron, scripts) | `createSupabaseDrizzle({ schema, supabase?, connectionString?, casing? })` → `{ admin, rls, close }`. `admin` bypasses RLS. `rls(...)` runs a transaction after resolving verified claims from the bound Supabase client. Underlying Postgres pools are cached by imported schema object + connection config, so this ergonomic factory can be called with a request-scoped Supabase client. |
| `@zeno-lib/db/clients` | Lower-level server code | `createDrizzleClients({ schema, connectionString?, casing? })` → `{ getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient, closeDrizzleSupabaseClients }`. Opens two `postgres-js` pools. `getDrizzleSupabaseAdminClient()` returns a Drizzle db that **bypasses RLS**. `getDrizzleSupabaseClient(supabaseOrClaims?)` accepts a Supabase client (preferred) or already-verified Supabase JWT claims and returns `{ runTransaction }`. |
| `@zeno-lib/db/config` | `drizzle.config.ts` in each consuming package/app | `defineDrizzleConfig({ schema, ...overrides })` — preset that defaults `out` to `./supabase/migrations`, dialect to `postgresql`, `casing` to `"snake_case"`, reads `DATABASE_URL` from env, and sets `entities.roles.provider: "supabase"`. |
| `@zeno-lib/db/schema` | Application schema files | Re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`. Plus a local `timestamps` mixin (`createdAt`, `updatedAt`). |
| `@zeno-lib/db/drizzle-orm` | Application schema/query files | Re-exports `drizzle-orm` helpers such as `sql`, `eq`, `and`, `or`, `isNull`, etc. Prefer this in consumer code/docs over direct `drizzle-orm` imports. |
| `@zeno-lib/db/pg-core` | Application schema files | Re-exports `drizzle-orm/pg-core` builders such as `pgTable`, `pgPolicy`, `uuid`, `text`, etc. |
| `@zeno-lib/db/drizzle-kit` | Rare Drizzle Kit config extensions | Re-exports `drizzle-kit`. Most consumers only need `@zeno-lib/db/config`. |
| `@zeno-lib/db/postgres` | Rare direct `postgres-js` usage | Re-exports `postgres`. Keep this server-only. |

Both factories read `DATABASE_URL` from `process.env` with an optional `{ connectionString }` override; they throw `"Missing DATABASE_URL environment variable"` if neither resolves. Runtime and config default `casing` to `"snake_case"` so TypeScript camelCase keys map to snake_case database identifiers unless explicitly overridden. Both pools pass `prepare: false` to `postgres-js` so the Supabase transaction pooler (port 6543) works. The RLS path resolves verified JWT claims via `supabase.auth.getClaims()` when given a Supabase client, validates the `role` against `anon | authenticated` (default `anon`), and then uses `set local role`; use the admin client for service-role work.

## Usage Patterns

RLS-aware per request — pass the request-scoped Supabase client at creation time:

```ts
// route.ts
import { createClient } from "@zeno-lib/supabase/server"
import { createSupabaseDrizzle } from "@zeno-lib/db"
import { posts } from "./schema"
import * as schema from "./schema"

const supabase = await createClient()
const db = createSupabaseDrizzle({ schema, supabase })
const mine = await db.rls((rlsDb) => rlsDb.select().from(posts)) // RLS enforced
```

Pass the imported schema module object to `createSupabaseDrizzle(...)`; do not create fresh schema object literals per request, or the pool cache cannot be reused.

Admin (bypasses RLS — webhooks, admin tasks, background jobs, seeding):

```ts
import { createSupabaseDrizzle } from "@zeno-lib/db"
import * as schema from "./schema"
import { posts } from "./schema"

const db = createSupabaseDrizzle({ schema })
await db.admin.select().from(posts) // RLS bypassed
```

Calling `db.rls(...)` without a `supabase` option throws immediately; missing request auth should not silently become an anon query.

Schema with an RLS policy:

```ts
// schema.ts
import { sql } from "@zeno-lib/db/drizzle-orm"
import { pgPolicy, pgTable, text, uuid } from "@zeno-lib/db/pg-core"
import { authUid, authUsers, authenticatedRole, timestamps } from "@zeno-lib/db/schema"

export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid().notNull().references(() => authUsers.id),
    title: text().notNull(),
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

- **Do not import `@zeno-lib/db/clients` from a Client Component.** `postgres-js` opens a TCP socket — server-only. Browser code should call your Server Actions/Route Handlers for application data; direct browser Supabase clients are reserved for specialized Supabase features such as realtime.
- **Do not tell consumers to install/import `drizzle-orm`, `drizzle-kit`, or `postgres` directly for normal DB package usage.** `@zeno-lib/db` owns those dependencies and exposes the expected re-export paths plus a `drizzle-kit` binary shim, matching the convenience pattern from `@zeno-lib/test`.
- **Do not run queries outside `db.rls(...)` when you intend RLS to apply.** A query on `db.admin` executes as the connection role, bypassing the policies you authored. The JWT claims + role are only set inside that transaction.
- **Do not pass raw JWT strings or unverified session payloads into RLS helpers.** Pass a Supabase client, or verify first with Supabase Auth (`auth.getClaims()` / equivalent) and pass the resulting claims object. The DB package deliberately does not decode raw tokens.
- **Do not write RLS policies as raw SQL in `supabase/migrations/` by hand.** `pgPolicy(...)` in the schema is the source of truth — drizzle-kit emits `CREATE POLICY` SQL during `generate`. A hand-written policy file will desync from the schema and won't survive the next `drizzle-kit generate`.
- **Do not declare the Supabase-built-in roles (`anon`, `authenticated`, `service_role`, `postgres_role`, `supabase_auth_admin`).** They're pre-existing in every Supabase project. Reference them via the `.existing()` exports from `@zeno-lib/db/schema`.
- **Do not omit `prepare: false`** if you ever construct your own `postgres-js` client against a Supabase pooler URL — prepared statements aren't supported in transaction-mode pooling and queries fail at runtime.
- **Do not create fresh schema object literals per request.** `createSupabaseDrizzle()` reuses pools only when callers pass the same imported schema object + connection config.
- **Do not interpolate an unvalidated `role` into `set local role`.** `getDrizzleSupabaseClient` only accepts `anon | authenticated` (defaulting to `anon`) before interpolating, so a forged `role` claim can't inject SQL or switch into `service_role`. Keep that allowlist if you fork the file.

## Dependencies & Edges

Runtime deps: `drizzle-orm`, `drizzle-kit`, `postgres`. Dev deps: `@zeno-lib/test`, `@zeno-lib/typescript`, `@types/node`. No workspace runtime deps. JWT verification belongs to Supabase Auth; `clients.ts` calls `supabase.auth.getClaims()` when given a Supabase client, or accepts already-verified claims for lower-level callers, then installs them into the transaction-local Postgres settings used by `auth.uid()` / `auth.jwt()`. Env loading (e.g. `dotenv/config`) is the consumer's responsibility — `drizzle.config.ts` should `import "dotenv/config"` at the top when run outside a framework that auto-loads `.env` (Next.js).

Used by: any package or app that needs to read/write Supabase Postgres with typed schemas. Reads no other `@zeno-lib/*` package.

Coexists with `@zeno-lib/supabase`: consumers typically import `createClient` from `@zeno-lib/supabase/server` for auth and import `createSupabaseDrizzle` from this package for data.

## Pitfalls

- **`drizzle-kit migrate` tracks state in `__drizzle_migrations`, not by file name.** Pre-existing `.sql` files in `supabase/migrations/` that weren't produced by `drizzle-kit generate` are ignored by `drizzle-kit migrate`. `npx supabase db reset`, however, applies *every* file in the directory alphabetically — so mixing hand-written SQL with drizzle-generated SQL works for resets but not for incremental migration tracking.
- **`DATABASE_URL` should use the transaction pooler (port 6543) in production**; local Supabase uses the direct port `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. `prepare: false` is already set so the pooler works.
- **`casing` defaults to `"snake_case"` in both runtime and migrations.** If a caller overrides it, keep runtime and `defineDrizzleConfig(...)` aligned or generated SQL and runtime queries can disagree about column names.
- **Forgetting `entities.roles.provider: "supabase"`** would make drizzle-kit try to drop Supabase's built-in roles in the next migration. The shared `defineDrizzleConfig` sets this by default — don't override `entities` without re-merging this flag.
- **The "claims object" is Supabase's verified JWT payload.** Prefer passing the Supabase client so `auth.getClaims()` resolves it for you. If passing claims directly, they must already be verified.
- **`request.jwt.claims` is set via `set_config(..., true)`** (transaction-local), so it auto-resets at commit/rollback. Run each request's queries inside its own `rls(...)` transaction so the context never leaks across requests.
- **`test` covers public package behavior without connecting eagerly** — default casing, re-export paths, owned Drizzle deps, and the `drizzle-kit` binary shim.
