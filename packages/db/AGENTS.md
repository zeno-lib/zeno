# `@zeno-lib/db` — Intent

Drizzle ORM wrapper for the Supabase Postgres database. Four files: two runtime factories, a `drizzle-kit` config preset, and shared schema primitives. This package owns the database; `@zeno-lib/supabase` owns auth, storage, and the SSR client.

## Purpose & Scope

Provides a Drizzle-based interface for everything DB-related against Supabase Postgres: a service-role client factory, a per-request RLS wrapper, a `drizzle-kit` config preset pre-tuned for Supabase, and re-exports of `drizzle-orm/supabase` roles, tables, and helpers.

**Owns:** schema (TS source of truth), migrations (`drizzle-kit generate`/`migrate`), RLS roles & policies (authored via `pgPolicy(...)` in schema files), typed runtime queries, the `postgres-js` connection.

**Does NOT own:** Supabase Auth, Storage, Edge Functions, the SSR cookie wiring (all in `@zeno-lib/supabase`). Browser-side data access — `postgres-js` is server-only; the browser still talks to Supabase via `postgrest` / `supabase-js`.

## Entry Points & Contracts

| Import | Use from | Returns / does |
|---|---|---|
| `@zeno-lib/db/client` | Server code (Server Components, Route Handlers, Server Actions, cron, scripts) | `createDb()` factory — `postgres-js` client + Drizzle wrapper. Bypasses RLS (intended for service-role connections). |
| `@zeno-lib/db/rls` | Server code that acts on behalf of an authenticated user | `createDbForRequest(db, jwt)` — wraps an existing `db` with `.rls(fn)`; `fn` runs inside a transaction with `request.jwt.claims` set and the role switched to `authenticated`. |
| `@zeno-lib/db/config` | `drizzle.config.ts` in each consuming package/app | `defineDrizzleConfig({ schema, ...overrides })` — preset that defaults `out` to `./supabase/migrations`, dialect to `postgresql`, reads `DATABASE_URL` from env, and sets `entities.roles.provider: "supabase"`. |
| `@zeno-lib/db/schema` | Application schema files | Re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`. Plus a local `timestamps` mixin (`createdAt`, `updatedAt`). |

`createDb` reads `DATABASE_URL` from `process.env` with an optional `{ connectionString }` override; throws `"Missing DATABASE_URL environment variable"` if neither resolves. Always passes `prepare: false` to `postgres-js` so the Supabase transaction pooler (port 6543) works.

## Usage Patterns

Service-role at module scope:

```ts
// db.ts
import { createDb } from "@zeno-lib/db/client"
import * as schema from "./schema"
export const db = createDb({ schema })
```

Per-request with RLS enforcement:

```ts
// route.ts
import { createClient } from "@zeno-lib/supabase/server"
import { createDbForRequest } from "@zeno-lib/db/rls"
import { db } from "./db"
import { posts } from "./schema"

const supabase = await createClient()
const { data: { session } } = await supabase.auth.getSession()
const userDb = createDbForRequest(db, session!.access_token)
const rows = await userDb.rls((tx) => tx.select().from(posts))
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

- **Do not call `createDb()` from a Client Component.** `postgres-js` opens a TCP socket — server-only. Browser code talks to Supabase via REST (`@supabase/supabase-js`) or via your own Server Actions/Route Handlers.
- **Do not run queries outside `rls(...)` when you intend RLS to apply.** Queries against the parent `db` execute as the connection role, bypassing the policies you authored. The whole point of `createDbForRequest` is the transaction scope.
- **Do not write RLS policies as raw SQL in `supabase/migrations/` by hand.** `pgPolicy(...)` in the schema is the source of truth — drizzle-kit emits `CREATE POLICY` SQL during `generate`. A hand-written policy file will desync from the schema and won't survive the next `drizzle-kit generate`.
- **Do not declare the Supabase-built-in roles (`anon`, `authenticated`, `service_role`, `postgres_role`, `supabase_auth_admin`).** They're pre-existing in every Supabase project. Reference them via the `.existing()` exports from `@zeno-lib/db/schema`.
- **Do not omit `prepare: false`** if you ever construct your own `postgres-js` client against a Supabase pooler URL — prepared statements aren't supported in transaction-mode pooling and queries fail at runtime.
- **Do not call `createDb()` per request.** Each call opens a new connection pool. Create one `db` at module scope and reuse it; wrap with `createDbForRequest(db, jwt)` per request.

## Dependencies & Edges

Peer: `drizzle-orm >=0.44`, `drizzle-kit >=0.31`, `postgres >=3.4`. No workspace runtime deps. Env loading (e.g. `dotenv/config`) is the consumer's responsibility — `drizzle.config.ts` should `import "dotenv/config"` at the top when run outside a framework that auto-loads `.env` (Next.js).

Used by: any package or app that needs to read/write Supabase Postgres with typed schemas. Reads no other `@zeno-lib/*` package.

Coexists with `@zeno-lib/supabase`: consumers typically import `createClient` from `@zeno-lib/supabase/server` for auth and import `createDb` / `createDbForRequest` from this package for data.

## Pitfalls

- **`drizzle-kit migrate` tracks state in `__drizzle_migrations`, not by file name.** Pre-existing `.sql` files in `supabase/migrations/` that weren't produced by `drizzle-kit generate` are ignored by `drizzle-kit migrate`. `npx supabase db reset`, however, applies *every* file in the directory alphabetically — so mixing hand-written SQL with drizzle-generated SQL works for resets but not for incremental migration tracking.
- **`DATABASE_URL` should use the transaction pooler (port 6543) in production**; local Supabase uses the direct port `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. The `prepare: false` flag is already set by `createDb` so the pooler works.
- **Forgetting `entities.roles.provider: "supabase"`** would make drizzle-kit try to drop Supabase's built-in roles in the next migration. The shared `defineDrizzleConfig` sets this by default — don't override `entities` without re-merging this flag.
- **The `<Database>` generic on `@zeno-lib/supabase/client`** (supabase-js types from `supabase gen types`) and **the `schema` generic on `createDb`** (Drizzle inferred types) are independent. Drizzle is the source of truth for app tables; `supabase gen types` is no longer needed if you only use Drizzle for queries.
- **`request.jwt.claims` is set via `set_config(..., true)`** — the `true` makes it transaction-local. Long-running transactions hold the claim; ensure each request runs its own `rls(fn)` invocation so claims don't leak across requests.
- **`scripts` has only `types:check`** — no build, no test. Add scripts if/when the surface grows.
