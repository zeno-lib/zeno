---
"@zeno-lib/db": minor
---

Add `@zeno-lib/db`: Drizzle ORM wrapper for Supabase Postgres. Owns schema, migrations, RLS roles & policies, and typed queries; coexists with `@zeno-lib/supabase` which keeps owning Auth, Storage, and SSR client wiring.

Public surface:

- `@zeno-lib/db` — `createSupabaseDrizzle({ schema, supabase?, connectionString? })` returns `{ admin, rls, close }`. `admin` bypasses RLS. `rls(...)` runs a transaction after resolving verified claims from the bound Supabase client. Underlying Postgres pools are cached by imported schema object + connection config, so this ergonomic factory can be called with a request-scoped Supabase client.
- `@zeno-lib/db/clients` — lower-level `createDrizzleClients({ schema, connectionString? })` returns `{ getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient, closeDrizzleSupabaseClients }`. `getDrizzleSupabaseClient(supabaseOrClaims?)` accepts a Supabase client or already-verified Supabase JWT claims and returns `{ runTransaction }`.
- `@zeno-lib/db/config` — `defineDrizzleConfig({ schema, ...overrides })` preset for `drizzle.config.ts`. Defaults `out: "./supabase/migrations"`, dialect `postgresql`, reads `DATABASE_URL`, and sets `entities.roles.provider: "supabase"` so Supabase built-in roles aren't touched.
- `@zeno-lib/db/schema` — re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`, plus a `timestamps` mixin.

Peer deps: `drizzle-orm 1.0.0-rc.3`, `drizzle-kit 1.0.0-rc.3`, `postgres >=3.4`.
Consumers import Drizzle, Drizzle Kit, and `postgres-js` APIs directly from
those packages.
