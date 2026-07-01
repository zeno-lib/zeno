# @zeno-lib/db

## 0.1.0

### Minor Changes

- 0cc1ea8: Add `@zeno-lib/db`: Drizzle ORM wrapper for Supabase Postgres. Owns schema, migrations, RLS roles & policies, and typed queries; coexists with `@zeno-lib/supabase` which keeps owning Auth, Storage, and SSR client wiring.

  Public surface:

  - `@zeno-lib/db` — five client factories. Each takes an optional Drizzle config (`{ relations?, logger?, casing? }`) plus an optional `connectionString` that defaults to `SUPABASE_DATABASE_URL` (throwing `"Missing SUPABASE_DATABASE_URL environment variable"` if neither resolves). All clients are queried directly — `await db.select().from(t)`, `await db.query.t.findMany()`, `db.transaction(cb)`, `db.close()`:
    - `createAdminClient(config?)` bypasses RLS (webhooks, admin tasks, background jobs, seeding), running as the connection `postgres` role; no Supabase client needed.
    - `createAuthClient(supabase, config?)` is RLS-scoped to a Supabase client: verified claims are resolved via `supabase.auth.getClaims()` on every query, so it always reflects the live session.
    - `createSupabaseClient(accessToken, config?)` is RLS-scoped to an already-verified, decoded token (`SupabaseToken` — the `role` + `sub` claims).
    - `createAnonClient(config?)` runs every query as `anon`.
    - `createServiceClient(config?)` runs every query as `service_role` (BYPASSRLS) — the only path to `service_role`. User tokens (`createAuthClient` / `createSupabaseClient`) clamp the role to `anon | authenticated`, so a forged `service_role` claim is downgraded to `anon`.
    - Each awaited single statement is recorded and replayed inside its own RLS transaction (claims set via transaction-local `set_config(..., true)`, role via `set local role`); `db.transaction(cb)` runs several statements under one atomic RLS transaction. `relations` (from `defineRelations`) enables the relational query API. Pools are cached per `(kind, connectionString)` and reference-counted by `close()`.
  - `@zeno-lib/db/config` — `defineDrizzleConfig({ schema, ...overrides })` preset for `drizzle.config.ts`. Defaults `out: "./supabase/migrations"`, dialect `postgresql`, reads `SUPABASE_DATABASE_URL`, and sets `entities.roles.provider: "supabase"` so Supabase built-in roles aren't touched.
  - `@zeno-lib/db/schema` — re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`, plus a `timestamps` mixin.

  Peer deps: `drizzle-orm 1.0.0-rc.3`, `drizzle-kit 1.0.0-rc.3`, `postgres >=3.4`.
  Consumers import Drizzle, Drizzle Kit, and `postgres-js` APIs directly from
  those packages.

- 2215066: Add `@zeno-lib/schema`, a pure Drizzle table to Zod helper package. It peers on
  `drizzle-orm@1.0.0-rc.3` and `zod>=4`, exports
  `defineTableSchema(table, options?)`, returning `select`, `insert`, and
  `update` Zod schemas, and re-exports Drizzle ORM's first-party Zod helpers.

  Upgrade `@zeno-lib/db` to expect `drizzle-orm@1.0.0-rc.3` and
  `drizzle-kit@1.0.0-rc.3` as peer dependencies, matching Drizzle's v1 schema and
  Zod documentation.
