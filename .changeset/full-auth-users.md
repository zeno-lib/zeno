---
"@zeno-lib/db": minor
---

`auth.users` ships in full, from a new `@zeno-lib/db/auth` entrypoint.

```ts
import { authUsers } from "@zeno-lib/db/auth"
```

`drizzle-orm/supabase` exports 8 of the table's 35 columns, so putting `auth` in
`schemaFilter` made drizzle-kit want to drop the other 27, and every consumer
needing a foreign key into `auth.users` hand-wrote all 35 and got it wrong in a
different way. This one is generated with `drizzle-kit pull` and pinned in a
header comment to Supabase CLI 2.84.1, Postgres 17.6.1.095, GoTrue v2.188.1 and
`auth.schema_migrations` 20260302000000. A test asserts the column count, so a
Supabase bump that changes the shape fails loudly instead of drifting.

**`authUsers` is no longer exported from `@zeno-lib/db/schema`.** Import it from
`@zeno-lib/db/auth` instead. The other `drizzle-orm/supabase` re-exports
(`anonRole`, `authenticatedRole`, `authUid`, `realtimeMessages` and the rest) are
unchanged, and `authUserId()` still references the table for you, so most
schemas need no import at all.

The split is not tidiness. `drizzle-kit generate` applies no entity filter: it
passes `() => true`, and its config schema accepts neither `schemaFilter` nor
`entities`. Generating against `pgSchema("auth").existing()` with
`schemaFilter: ["public"]` set still emits `CREATE TABLE "auth"."users"`. The
only thing that keeps a Supabase-owned table out of your migration is it never
reaching the files your `schema` glob reads, so it cannot live in the module you
re-export from your schema barrel. Referencing it from a column stays safe: a
table reached only through a `references()` thunk is never collected.

The nine `auth` enums are not shipped. `auth.users` uses none of them (they
belong to the `mfa_*`, `oauth_*` and `sso_*` tables), and drizzle-kit maps enums
with no filter and no `existing` equivalent, so an exported one would be
`CREATE TYPE` in every command.

Several columns hold credential material (`encryptedPassword`, the `*Token`
columns). Select the columns you need rather than `select()`.
