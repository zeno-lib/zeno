# `@zeno-lib/db` — Intent

Supabase Postgres helpers built on Drizzle. Source files cover the root package
entrypoint, client helpers (admin + RLS), a Drizzle Kit config preset, and
curated Supabase schema primitives. This package owns Zeno's DB integration
contracts; consuming apps own their Drizzle, Drizzle Kit, and `postgres-js`
installations through peer dependencies.

## Purpose & Scope

Provides a Drizzle-based interface for Supabase Postgres: paired admin/RLS
clients, a `drizzle-kit` config preset pre-tuned for Supabase, selected
Supabase role/helper exports, RLS-by-default table helpers, and typed runtime
queries.

**Owns:** RLS-aware runtime factories, the Supabase Drizzle config preset,
selected Supabase role/helper conveniences, curated `pg-core` aliases,
`table` / `unsecureTable`, and the `timestamps` mixin.

**Does NOT own:** Supabase Auth, Storage, Edge Functions, the SSR cookie wiring
(all in `@zeno-lib/supabase`) or consumer-owned Drizzle, Drizzle Kit, and
`postgres-js` package surfaces.

## Entry Points & Contracts

| Import | Use from | Returns / does |
|---|---|---|
| `@zeno-lib/db` | Server code (Server Components, Route Handlers, Server Actions, cron, scripts) | `createSupabaseDrizzle({ schema, supabase?, connectionString? })` -> `{ admin, rls, close }`. `admin` bypasses RLS. `rls(...)` runs a transaction after resolving verified claims from the bound Supabase client. Underlying Postgres pools are cached by imported schema object + connection config, so this ergonomic factory can be called with a request-scoped Supabase client. `close()` is reference-counted: it releases this handle's share of the cached pools and only ends them once the last handle closes (so a per-request `close()` won't tear down pools other in-flight requests are using). |
| `@zeno-lib/db/clients` | Lower-level server code | `createDrizzleClients({ schema, connectionString? })` -> `{ getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient, closeDrizzleSupabaseClients }`. Opens two `postgres-js` pools. `getDrizzleSupabaseAdminClient()` returns a Drizzle db that **bypasses RLS**. `getDrizzleSupabaseClient(supabaseOrClaims?)` accepts a Supabase client (preferred) or already-verified Supabase JWT claims and returns `{ runTransaction }`. |
| `@zeno-lib/db/config` | `drizzle.config.ts` in each consuming package/app | `defineDrizzleConfig({ schema, ...overrides })` — preset that defaults `out` to `./supabase/migrations`, dialect to `postgresql`, reads `DATABASE_URL` from env, and sets `entities.roles.provider: "supabase"`. |
| `@zeno-lib/db/schema` | Application schema files | `table` (`snakeCase.table.withRLS`) for RLS-by-default tables, `unsecureTable` (`snakeCase.table`) for intentional non-RLS tables, curated Supabase role/helper exports from `drizzle-orm/supabase`, curated `pg-core` aliases such as `policy`, `role`, `schema`, `sequence`, `view`, `materializedView`, `tableCreator`, and `enum` (import with a local alias because `enum` is reserved), plus a local `timestamps` mixin (`createdAt`, `updatedAt`). |

Keep this entrypoint list focused on Zeno-owned DB helpers. Consumers import
Drizzle APIs and run Drizzle Kit directly from their peer dependencies.

Both factories read `DATABASE_URL` from `process.env` with an optional
`{ connectionString }` override; they throw
`"Missing DATABASE_URL environment variable"` if neither resolves. Both pools
pass `prepare: false` to `postgres-js` so the Supabase transaction pooler (port
6543) works. The RLS path resolves verified JWT claims via
`supabase.auth.getClaims()` when given a Supabase client, validates the `role`
against `anon | authenticated` (default `anon`), and then uses `set local role`;
use the admin client for service-role work.

## Usage Patterns

RLS-aware per request — pass the request-scoped Supabase client at creation time:

```ts
// route.ts
import { createSupabaseDrizzle } from "@zeno-lib/db"
import { createClient } from "@zeno-lib/supabase/server"
import { posts } from "./schema"
import * as schema from "./schema"

const supabase = await createClient()
const db = createSupabaseDrizzle({ schema, supabase })
const mine = await db.rls((rlsDb) => rlsDb.select().from(posts)) // RLS enforced
```

Pass the imported schema module object to `createSupabaseDrizzle(...)`; do not
create fresh schema object literals per request, or the pool cache cannot be
reused.

Admin (bypasses RLS — webhooks, admin tasks, background jobs, seeding):

```ts
import { createSupabaseDrizzle } from "@zeno-lib/db"
import * as schema from "./schema"
import { posts } from "./schema"

const db = createSupabaseDrizzle({ schema })
await db.admin.select().from(posts) // RLS bypassed
```

Schema with an RLS policy:

```ts
// schema.ts
import { authenticatedRole, authUid, authUsers, policy, table, timestamps } from "@zeno-lib/db/schema"
import { sql } from "drizzle-orm"
import { text, uuid } from "drizzle-orm/pg-core"

export const posts = table(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid().notNull().references(() => authUsers.id),
    title: text().notNull(),
    ...timestamps,
  },
  (t) => [
    policy("posts_owner_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.userId} = ${authUid}`,
    }),
  ]
)
```

`drizzle.config.ts`:

```ts
import { defineDrizzleConfig } from "@zeno-lib/db/config"
export default defineDrizzleConfig({ schema: "./src/schema.ts" })
```

## Anti-patterns

- **Do not import `@zeno-lib/db/clients` from a Client Component.**
  `postgres-js` opens a TCP socket — server-only. Browser code should call your
  Server Actions/Route Handlers for application data; direct browser Supabase
  clients are reserved for specialized Supabase features such as realtime.
- **Keep broad Drizzle package APIs peer-owned.** Consumer schema/query files
  import `drizzle-orm`, general `drizzle-orm/pg-core` column builders, and
  `postgres` APIs directly, except for Zeno-owned schema helpers and curated
  `pg-core` aliases exported from `@zeno-lib/db/schema`.
- **Keep Drizzle Kit CLI ownership in the consuming package.** Consumers install
  `drizzle-kit` and run its CLI from their own package scripts.
- **Do not run queries outside `db.rls(...)` when you intend RLS to apply.** A
  query on `db.admin` executes as the connection role, bypassing the policies
  you authored. The JWT claims + role are only set inside that transaction.
- **Do not pass raw JWT strings or unverified session payloads into RLS
  helpers.** Pass a Supabase client, or verify first with Supabase Auth
  (`auth.getClaims()` / equivalent) and pass the resulting claims object. The DB
  package deliberately does not decode raw tokens.
- **Do not write RLS policies as raw SQL in `supabase/migrations/` by hand.**
  `policy(...)` in the schema is the source of truth — drizzle-kit emits
  `CREATE POLICY` SQL during `generate`. A hand-written policy file will desync
  from the schema and won't survive the next `drizzle-kit generate`.
- **Do not declare the Supabase-built-in roles (`anon`, `authenticated`,
  `service_role`, `postgres_role`, `supabase_auth_admin`).** They're
  pre-existing in every Supabase project. Reference them via the `.existing()`
  exports from `@zeno-lib/db/schema`.
- **Do not omit `prepare: false`** if you ever construct your own `postgres-js`
  client against a Supabase pooler URL — prepared statements aren't supported in
  transaction-mode pooling and queries fail at runtime.
- **Do not create fresh schema object literals per request.**
  `createSupabaseDrizzle()` reuses pools only when callers pass the same
  imported schema object + connection config.
- **Do not interpolate an unvalidated `role` into `set local role`.**
  `getDrizzleSupabaseClient` only accepts `anon | authenticated` (defaulting to
  `anon`) before interpolating, so a forged `role` claim can't inject SQL or
  switch into `service_role`. Keep that allowlist if you fork the file.

## Dependencies & Edges

Peer deps: `drizzle-orm 1.0.0-rc.3`, `drizzle-kit 1.0.0-rc.3`,
`postgres >=3.4`. Dev deps: `@zeno-lib/typescript`, `@types/node`, `vitest`,
plus local copies of the peer deps for tests and type-checking. No workspace
runtime deps.

JWT verification belongs to Supabase Auth; `clients.ts` calls
`supabase.auth.getClaims()` when given a Supabase client, or accepts
already-verified claims for lower-level callers, then installs them into the
transaction-local Postgres settings used by `auth.uid()` / `auth.jwt()`. Env
loading (e.g. `dotenv/config`) is the consumer's responsibility —
`drizzle.config.ts` should `import "dotenv/config"` at the top when run outside
a framework that auto-loads `.env` (Next.js).

Used by: any package or app that needs to read/write Supabase Postgres with
typed schemas. Reads no other `@zeno-lib/*` package.

Coexists with `@zeno-lib/supabase`: consumers typically import `createClient`
from `@zeno-lib/supabase/server` for auth and import `createSupabaseDrizzle`
from this package for data.

Coexists with `@zeno-lib/schema`: consumers define Drizzle tables with
`table` / `unsecureTable` plus direct Drizzle column imports, call
`defineTableSchema(...)` from `@zeno-lib/schema`, and keep DB clients out of
modules that need to be imported by Client Components for validation.

## Pitfalls

- **`drizzle-kit migrate` tracks state in `__drizzle_migrations`, not by file
  name.** Pre-existing `.sql` files in `supabase/migrations/` that weren't
  produced by `drizzle-kit generate` are ignored by `drizzle-kit migrate`.
  `npx supabase db reset`, however, applies *every* file in the directory
  alphabetically — so mixing hand-written SQL with drizzle-generated SQL works
  for resets but not for incremental migration tracking.
- **`DATABASE_URL` should use the transaction pooler (port 6543) in production**;
  local Supabase uses the direct port
  `postgresql://postgres:postgres@127.0.0.1:54322/postgres`. `prepare: false` is
  already set so the pooler works.
- **Drizzle v1 casing lives on entity constructors, not DB config.** Use
  `table(...)` for app-owned RLS tables and `unsecureTable(...)` for the
  rare table that intentionally has no RLS; both map TypeScript camelCase to
  snake_case database identifiers. Use direct Drizzle casing helpers only when
  the database intentionally preserves camelCase identifiers or needs a custom
  table constructor.
- **Forgetting `entities.roles.provider: "supabase"`** would make drizzle-kit
  try to drop Supabase's built-in roles in the next migration. The shared
  `defineDrizzleConfig` sets this by default — don't override `entities` without
  re-merging this flag.
- **Do not append `.enableRLS()` manually.** Use `table(...)` for RLS-enabled
  tables. Drizzle v1 also enables RLS automatically when policies are present,
  and `.enableRLS()` is deprecated for that common case.
- **The "claims object" is Supabase's verified JWT payload.** Prefer passing the
  Supabase client so `auth.getClaims()` resolves it for you. If passing claims
  directly, they must already be verified.
- **`request.jwt.claims` is set via `set_config(..., true)`**
  (transaction-local), so it auto-resets at commit/rollback. Run each request's
  queries inside its own `rls(...)` transaction so the context never leaks across
  requests.
- **`test` covers public package behavior without connecting eagerly** — peer
  dependency expectations, focused package exports, and the RLS/client
  contracts.
