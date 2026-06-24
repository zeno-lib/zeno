---
"@zeno-lib/db": minor
---

Add `@zeno-lib/db`: Drizzle ORM wrapper for Supabase Postgres. Owns schema, migrations, RLS roles & policies, and typed queries; coexists with `@zeno-lib/supabase` which keeps owning Auth, Storage, and SSR client wiring.

Public surface:

- `@zeno-lib/db` — two ergonomic factories:
  - `createSupabaseDrizzle({ schema, relations?, supabase, connectionString? })` returns an RLS-aware client you query directly as the signed-in Supabase user. `supabase` is mandatory (a Supabase client; raw tokens/claims are not accepted). A single statement runs in its own RLS transaction: `await db.select().from(t)`, `await db.query.t.findMany()` (the chain is recorded and replayed inside one transaction after resolving verified claims via `supabase.auth.getClaims()`, with the role switched). `db.transaction(cb)` runs several statements under one atomic RLS transaction, and `db.close()` releases the pools. Creating it without a client throws immediately.
  - `createAdminDrizzle({ schema, relations?, connectionString? })` returns a client that bypasses RLS (webhooks, admin tasks, background jobs, seeding); it needs no Supabase client and connects via `DATABASE_URL`. Query it directly (`await db.select().from(t)`, `db.transaction(cb)`, `db.close()`).
  - `relations` (from drizzle's `defineRelations`) enables the relational query API. Underlying Postgres pools are cached by imported schema object + connection config, so either factory can be called per request.
- `@zeno-lib/db/clients` — lower-level `createDrizzleClients({ schema, connectionString? })` returns `{ getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient, closeDrizzleSupabaseClients }`. `getDrizzleSupabaseClient(supabase)` takes a Supabase client and returns `{ runTransaction }`.
- `@zeno-lib/db/config` — `defineDrizzleConfig({ schema, ...overrides })` preset for `drizzle.config.ts`. Defaults `out: "./supabase/migrations"`, dialect `postgresql`, reads `DATABASE_URL`, and sets `entities.roles.provider: "supabase"` so Supabase built-in roles aren't touched.
- `@zeno-lib/db/schema` — re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`, plus a `timestamps` mixin.

Peer deps: `drizzle-orm 1.0.0-rc.3`, `drizzle-kit 1.0.0-rc.3`, `postgres >=3.4`.
Consumers import Drizzle, Drizzle Kit, and `postgres-js` APIs directly from
those packages.
