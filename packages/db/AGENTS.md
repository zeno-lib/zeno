# `@zeno-lib/db` — Intent

Supabase Postgres helpers built on Drizzle. Source files cover the root package
entrypoint, five client factories (admin + four RLS-scoped), a Drizzle Kit
config preset, and curated Supabase schema primitives. This package owns Zeno's
DB integration contracts; consuming apps own their Drizzle, Drizzle Kit, and
`postgres-js` installations through peer dependencies.

## Purpose & Scope

Provides a Drizzle-based interface for Supabase Postgres: an admin client plus
four RLS-scoped client factories, a `drizzle-kit` config preset pre-tuned for
Supabase, selected Supabase role/helper exports, RLS-by-default table helpers,
and typed runtime queries.

**Owns:** RLS-aware runtime factories, the Supabase Drizzle config preset,
selected Supabase role/helper conveniences, curated `pg-core` aliases,
`table` / `unsecureTable`, common ID/audit column helpers and mixins, and
policy helpers.

**Does NOT own:** Supabase Auth, Storage, Edge Functions, the SSR cookie wiring
(all in `@zeno-lib/supabase`) or consumer-owned Drizzle, Drizzle Kit, and
`postgres-js` package surfaces.

## Entry Points & Contracts

| Import | Use from | Returns / does |
|---|---|---|
| `@zeno-lib/db` | Server code (Server Components, Route Handlers, Server Actions, cron, scripts) | Five factories, each `(…, config?: CreateClientConfig)` where `config` is a Drizzle config (`{ relations?, logger?, casing? }`) plus an optional `connectionString` (defaults to `SUPABASE_DATABASE_URL`). **`createAdminClient(config?)`** -> a client that **bypasses RLS** (webhooks, admin tasks, background jobs, seeding); queried directly (`db.select().from(t)`, `db.transaction(cb)`). **`createAuthClient(supabase, config?)`** -> RLS client bound to a Supabase client; verified claims are resolved via `supabase.auth.getClaims()` on **every** query (always reflects the live session). **`createSupabaseClient(accessToken, config?)`** -> RLS client scoped to an already-verified, **decoded** token (`SupabaseToken` = the `role` + `sub` claims, e.g. from `getClaims()`). **`createAnonClient(config?)`** -> RLS client that runs every query as `anon`. **`createServiceClient(config?)`** -> client that runs every query as `service_role` (bypasses RLS via Supabase's BYPASSRLS grant) — the only path to `service_role`. All four RLS clients are **queried directly**: each awaited single statement (`db.select().from(t)`, `db.query.t.findMany()`) is recorded and replayed inside its own RLS transaction with the claims set and the role switched; `db.transaction(async (tx) => { … })` runs several statements under one atomic RLS transaction. `relations` (from `defineRelations`) enables the relational query API. Postgres pools are cached per `(kind, connectionString)` — the `admin` and `rls` kinds get separate pools so the admin connection is never role-switched. `close()` is reference-counted: it releases this handle's share of the pool and only ends it once the last handle closes. |
| `@zeno-lib/db/config` | `drizzle.config.ts` in each consuming package/app | `defineDrizzleConfig({ schema, ...overrides })` — preset that defaults `out` to `./supabase/migrations`, dialect to `postgresql`, reads `SUPABASE_DATABASE_URL` from env, and sets `entities.roles.provider: "supabase"`. |
| `@zeno-lib/db/schema` | Application schema files | `table` (`snakeCase.table.withRLS`) for RLS-by-default tables, `unsecureTable` (`snakeCase.table`) for intentional non-RLS tables, common column helpers (`primaryId`, `authUserId`, `createdBy`, `updatedBy`), audit mixins (`timestamps` for xAt, `authorship` for xBy, `auditColumns` for all four), generic policy helpers (`selectPolicy`, `insertPolicy`, `updatePolicy`, `deletePolicy`, `allPolicy`), authenticated-owner policy helpers, curated Supabase role/helper exports from `drizzle-orm/supabase`, and curated `pg-core` aliases such as `policy`, `role`, `schema`, `sequence`, `view`, `materializedView`, `tableCreator`, and `enum` (import with a local alias because `enum` is reserved). |

Keep this entrypoint list focused on Zeno-owned DB helpers. Consumers import
Drizzle APIs and run Drizzle Kit directly from their peer dependencies.

All factories read `SUPABASE_DATABASE_URL` from `process.env` with an optional
`{ connectionString }` override; they throw
`"Missing SUPABASE_DATABASE_URL environment variable"` if neither resolves. Pools
pass `prepare: false` to `postgres-js` so the Supabase transaction pooler (port
6543) works. The RLS clients clamp a **user token's** `role` to
`anon | authenticated` (default `anon`) via `ALLOWED_RLS_ROLES` before
`set local role`, so a forged/unexpected claim can't escalate. `service_role` is
reachable only through the explicit `createServiceClient` (a trusted backend
decision), never from a JWT; use `createAdminClient` for RLS-bypassing work as
the connection role (`postgres`).

## Usage Patterns

RLS-aware per request — pass the request-scoped Supabase client to
`createAuthClient`, then query `db` directly for a single statement (claims are
re-resolved via `getClaims()` per query):

```ts
// route.ts
import { createAuthClient } from "@zeno-lib/db"
import { createClient } from "@zeno-lib/supabase/server"
import { posts } from "./schema"

const supabase = await createClient()
const db = createAuthClient(supabase)
const myPosts = await db.select().from(posts) // RLS enforced
```

If you already hold the verified, decoded JWT payload, skip the round-trip with
`createSupabaseClient(accessToken)`. For unauthenticated reads use
`createAnonClient()`.

Multiple statements under one atomic RLS transaction — use `db.transaction(...)`:

```ts
const created = await db.transaction(async (tx) => {
  const [post] = await tx.insert(posts).values({ title }).returning()
  await tx.insert(auditLog).values({ postId: post.id })
  return post
})
```

Relational query API — pass `relations` (from `defineRelations`) at creation:

```ts
import { defineRelations } from "drizzle-orm"
import * as schema from "./schema"
const relations = defineRelations(schema)
const db = createAuthClient(supabase, { relations })
const myPosts = await db.query.posts.findMany() // RLS enforced
```

Pass a stable `relations` object per `(kind, connectionString)`; do not create
fresh `relations` literals per request, or a cached client built without
relations may be reused.

Admin (bypasses RLS — webhooks, admin tasks, background jobs, seeding) runs as
the connection `postgres` role and needs no Supabase client. For trusted work
that should run as `service_role` (BYPASSRLS), use `createServiceClient`:

```ts
import { createAdminClient, createServiceClient } from "@zeno-lib/db"
import { posts } from "./schema"

const admin = createAdminClient()
await admin.select().from(posts) // RLS bypassed, runs as postgres

const service = createServiceClient()
await service.select().from(posts) // RLS bypassed, runs as service_role
```

Schema with an RLS policy:

```ts
// schema.ts
import {
  authenticatedOwnerInsertPolicy,
  authenticatedOwnerSelectPolicy,
  authUserId,
  primaryId,
  table,
  timestamps,
} from "@zeno-lib/db/schema"
import { text } from "drizzle-orm/pg-core"

export const posts = table(
  "posts",
  {
    id: primaryId("uuid"),
    userId: authUserId(),
    title: text().notNull(),
    ...timestamps,
  },
  (t) => [
    authenticatedOwnerSelectPolicy("posts_owner_select", t.userId),
    authenticatedOwnerInsertPolicy("posts_owner_insert", t.userId),
  ]
)
```

`drizzle.config.ts`:

```ts
import { defineDrizzleConfig } from "@zeno-lib/db/config"
export default defineDrizzleConfig({ schema: "./src/schema.ts" })
```

## Anti-patterns

- **Do not import `@zeno-lib/db` factories from a Client Component.**
  `postgres-js` opens a TCP socket — server-only. Browser code should call your
  Server Actions/Route Handlers for application data; direct browser Supabase
  clients are reserved for specialized Supabase features such as realtime.
- **Keep broad Drizzle package APIs peer-owned.** Consumer schema/query files
  import `drizzle-orm`, general `drizzle-orm/pg-core` column builders, and
  `postgres` APIs directly, except for Zeno-owned schema helpers and curated
  `pg-core` aliases exported from `@zeno-lib/db/schema`.
- **Keep Drizzle Kit CLI ownership in the consuming package.** Consumers install
  `drizzle-kit` and run its CLI from their own package scripts.
- **Do not use `createAdminClient` / `createServiceClient` for user-scoped
  reads/writes.** They bypass RLS (running as `postgres` / `service_role`),
  ignoring the policies you authored. RLS applies only to `createAuthClient`,
  `createSupabaseClient`, and `createAnonClient`, whose claims + role are set
  inside the per-statement (or `db.transaction`) RLS transaction.
- **Do not feed a user-supplied token to `createServiceClient`.** It is the only
  path to `service_role` and clamps nothing — it is a trusted backend decision.
  User tokens go through `createAuthClient` / `createSupabaseClient`, which clamp
  the role to `anon | authenticated`; a forged `service_role` claim there is
  downgraded to `anon`, never honored.
- **Pass a verified, decoded token to `createSupabaseClient`.** `accessToken`
  is a `SupabaseToken` (the decoded `role` + `sub` claims, e.g. from
  `auth.getClaims()`), not a raw JWT string — it is not re-verified. Prefer
  `createAuthClient`, which resolves and verifies claims via `auth.getClaims()`
  itself.
- **Do not write RLS policies as raw SQL in `supabase/migrations/` by hand.**
  `policy(...)` / `selectPolicy(...)` / owner policy helpers in the schema are
  the source of truth — drizzle-kit emits
  `CREATE POLICY` SQL during `generate`. A hand-written policy file will desync
  from the schema and won't survive the next `drizzle-kit generate`.
- **Do not declare the Supabase-built-in roles (`anon`, `authenticated`,
  `service_role`, `postgres_role`, `supabase_auth_admin`).** They're
  pre-existing in every Supabase project. Reference them via the `.existing()`
  exports from `@zeno-lib/db/schema`.
- **Do not omit `prepare: false`** if you ever construct your own `postgres-js`
  client against a Supabase pooler URL — prepared statements aren't supported in
  transaction-mode pooling and queries fail at runtime.
- **Do not create fresh `relations` object literals per request.** Pools are
  cached per `(kind, connectionString)`, but a client built without `relations`
  (or with a different relations object) loses the relational query API; pass a
  stable `relations` object.
- **Do not interpolate an unvalidated `role` into `set local role`.** The RLS
  transaction runner clamps a user token's claim to `anon | authenticated`
  (defaulting to `anon`) via `ALLOWED_RLS_ROLES` before interpolating, so a forged
  `role` claim can't inject SQL or escalate into `service_role`. Keep that
  allowlist if you fork the file; `service_role` is granted only by
  `createServiceClient` via `fixedContext`, which the allowlist deliberately
  excludes.

## Dependencies & Edges

Peer deps: `drizzle-orm 1.0.0-rc.3`, `drizzle-kit 1.0.0-rc.3`,
`postgres >=3.4`. Dev deps: `@zeno-lib/typescript`, `@zeno-lib/test` (shared
Vitest config, wired via `vitest.config.ts`), `@types/node`, `dotenv`,
`supabase` (CLI for the local test stack), `vite`, `vitest`, plus local copies of
the peer deps for tests and type-checking. Both configs load `.env.test`, so
tests resolve `SUPABASE_DATABASE_URL` from there. No workspace runtime deps.

Tests run under a single Vitest config and fall into two kinds:

- **Unit** (`src/*.test.ts`): no connection. `clients.test.ts` exercises only the
  pool lifecycle (caching + reference-counted `close()`) using the **real**
  `postgres` driver via a counting passthrough — `postgres-js` connects lazily,
  so pools build and `end()` without a server. No `drizzle` mock.
- **Integration** (`test/rls.integration.test.ts`): connects to a **real local
  Supabase** (`pnpm dev` → `supabase start`, Postgres on `54322`) and verifies RLS
  enforcement, role/claims clamping, transaction-local context, and the relational
  query API end-to-end. The fixture lives under `test/` (schema) + `supabase/`
  (config + migrations) so it stays out of the published surface (`files: ["src"]`);
  the `dev`/`stop`/`reset`/`db:*` scripts drive the stack.

Both kinds run together under `pnpm test`, so **`test` requires the local Supabase
stack to be up** (CI starts it before `pnpm run ci`; locally run `pnpm dev` first,
or filter to a specific file — e.g. `pnpm exec vitest clients` — for a quick
connection-free unit run).

JWT verification belongs to Supabase Auth; `createAuthClient` calls
`supabase.auth.getClaims()` on the bound Supabase client, then installs the
verified claims into the transaction-local Postgres settings used by
`auth.uid()` / `auth.jwt()`. Env loading (e.g. `dotenv/config`) is the
consumer's responsibility.
`drizzle.config.ts` should `import "dotenv/config"` at the top when run outside
a framework that auto-loads `.env` (Next.js).

Used by: any package or app that needs to read/write Supabase Postgres with
typed schemas. Reads no other `@zeno-lib/*` package.

Coexists with `@zeno-lib/supabase`: consumers typically import `createClient`
from `@zeno-lib/supabase/server` for auth and import `createAuthClient`
from this package for data.

Coexists with `@zeno-lib/schema`: consumers define Drizzle tables with
`table` / `unsecureTable`, Zeno schema conveniences such as `primaryId`,
`authUserId`, and policy helpers, plus direct Drizzle column imports for
domain-specific columns. They call `defineTableSchema(...)` from
`@zeno-lib/schema`, and keep DB clients out of modules that need to be imported
by Client Components for validation.

## Pitfalls

- **`drizzle-kit migrate` tracks state in `__drizzle_migrations`, not by file
  name.** Pre-existing `.sql` files in `supabase/migrations/` that weren't
  produced by `drizzle-kit generate` are ignored by `drizzle-kit migrate`.
  `npx supabase db reset`, however, applies *every* file in the directory
  alphabetically — so mixing hand-written SQL with drizzle-generated SQL works
  for resets but not for incremental migration tracking.
- **`SUPABASE_DATABASE_URL` should use the transaction pooler (port 6543) in
  production**; local Supabase uses the direct port
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
- **`createAuthClient` resolves claims per query via `auth.getClaims()`.** It
  re-checks the live session on every awaited statement, so a single client
  reflects the current user without re-creation. `createSupabaseClient` instead
  trusts the decoded payload you pass once.
- **`request.jwt.claims` is set via `set_config(..., true)`**
  (transaction-local), so it auto-resets at commit/rollback — the RLS query proxy
  installs it inside each statement's own transaction, so the context never leaks
  across requests. No explicit `reset role` is needed.
- **The relational query API (`db.query.*`) needs a `relations` object.**
  Drizzle v1 reads `relations` (from `defineRelations`); without it `query.*` is
  unavailable. Pass the same stable `relations` object on every factory call
  sharing that connection, or a cached client built without relations will be
  reused. (The factories take a Drizzle config, not a `schema`; `schema` only
  feeds `defineRelations`.)
- **Each awaited single-statement `db` query is its own transaction.** It cannot
  span multiple statements; reach for `db.transaction(...)` when several
  statements must be atomic.
- **`test` needs the local Supabase stack running.** Unit specs
  (`src/*.test.ts`) never connect, but the integration spec
  (`test/rls.integration.test.ts`) runs in the same `pnpm test` pass and connects
  for real — start it with `pnpm dev` first, or that spec fails to connect.
