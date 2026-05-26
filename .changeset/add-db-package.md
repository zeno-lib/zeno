---
"@zeno-lib/db": minor
---

Add `@zeno-lib/db`: Drizzle ORM wrapper for Supabase Postgres. Owns schema, migrations, RLS roles & policies, and typed queries; coexists with `@zeno-lib/supabase` which keeps owning Auth, Storage, and SSR client wiring.

Public surface:

- `@zeno-lib/db/client` — `createDb({ connectionString?, schema? })` factory built on `drizzle-orm/postgres-js`. Service-role / RLS-bypass.
- `@zeno-lib/db/rls` — `createDbForRequest(db, jwt)` wraps an existing db with `.rls(fn)` which runs `fn` inside a transaction with `request.jwt.claims` set and the role switched to `authenticated`.
- `@zeno-lib/db/config` — `defineDrizzleConfig({ schema, ...overrides })` preset for `drizzle.config.ts`. Defaults `out: "./supabase/migrations"`, dialect `postgresql`, reads `DATABASE_URL`, and sets `entities.roles.provider: "supabase"` so Supabase built-in roles aren't touched.
- `@zeno-lib/db/schema` — re-exports of `anonRole`, `authenticatedRole`, `serviceRole`, `postgresRole`, `supabaseAuthAdminRole`, `authUsers`, `authUid`, `realtimeMessages`, `realtimeTopic` from `drizzle-orm/supabase`, plus a `timestamps` mixin.

Peer deps: `drizzle-orm >=0.44`, `drizzle-kit >=0.31`, `postgres >=3.4`.
