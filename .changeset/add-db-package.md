---
"@zeno-lib/db": minor
---

Add `@zeno-lib/db`: Drizzle ORM wrapper for Supabase Postgres. Owns schema, migrations, RLS roles & policies, and typed queries; coexists with `@zeno-lib/supabase` which keeps owning Auth, Storage, and SSR client wiring.

Public surface:

- `@zeno-lib/db/clients` — `createDrizzleClients({ schema, connectionString?, casing? })` returns `{ getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient, closeDrizzleSupabaseClients }`. Opens two `postgres-js` pools. `getDrizzleSupabaseAdminClient()` bypasses RLS. `getDrizzleSupabaseClient(verifiedClaims?)` accepts already-verified Supabase JWT claims and returns `{ runTransaction }` — queries run inside `runTransaction` get `request.jwt.claims` (JSON) + `request.jwt.claim.sub` set and `set local role` (validated against `anon | authenticated`) so RLS policies apply. `closeDrizzleSupabaseClients()` closes both pools for tests/scripts/shutdown.
- `@zeno-lib/db/config` — `defineDrizzleConfig({ schema, ...overrides })` preset for `drizzle.config.ts`. Defaults `out: "./supabase/migrations"`, dialect `postgresql`, reads `DATABASE_URL`, and sets `entities.roles.provider: "supabase"` so Supabase built-in roles aren't touched.
- `@zeno-lib/db/schema` — re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`, plus a `timestamps` mixin.

Peer deps: `drizzle-orm >=0.44`, `drizzle-kit >=0.31`, `postgres >=3.4`.
