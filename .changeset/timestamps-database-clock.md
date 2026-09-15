---
"@zeno-lib/db": minor
---

The update-side audit columns are owned by Postgres triggers now, and the
Drizzle-side hooks are gone.

`timestamps()` set `updatedAt.$onUpdate(...)` and `updatedBy()` set
`$onUpdate(() => authUid)`. Both are applied while Drizzle builds its own
statement, so a write arriving through PostgREST (the `supabase-js` client, the
dashboard, any REST caller) never ran them, and in a Supabase app that is most
writes. The columns were right only when you happened to write through Drizzle,
which is worse than a column you know needs a trigger. Both hooks are removed,
and `timestamps()` loses its `onUpdate` option with them.

A new `@zeno-lib/db/triggers` entrypoint returns the SQL that puts the columns
in Postgres's hands, where every writer reaches them:

```ts
import { auditTriggers } from "@zeno-lib/db/triggers"

console.log(auditTriggers(posts))
```

Drizzle Kit emits no trigger DDL, so the route is
`drizzle-kit generate --custom`, which writes an empty migration that is still
tracked: its snapshot links into the chain, so `drizzle-kit migrate` applies and
records it. **This is now a required step for any table using `timestamps()`,
`authorship()` or `auditColumns()`.** Without it, `updated_at` and `updated_by`
keep their insert values forever.

`auditTriggers` covers both columns; `updatedAtTrigger` and `updatedByTrigger`
cover one each. All three read the table's real name and schema, accept a plain
table name, take `column` / `name` / `schema` overrides, and emit re-runnable
SQL.

**Bug fix in the same area:** `createdBy()` and `updatedBy()` defaulted to
`authUid`, which is `(select auth.uid())`. Postgres rejects a subquery in a
column `DEFAULT` with "cannot use subquery in DEFAULT expression", so any
migration containing those columns failed to apply. They default to a bare
`` sql`auth.uid()` `` now, which is legal and resolves the same claim.

`timestamps()` also takes `withTimezone` (default `true`) and `precision` (0 to
6), forwarded by `auditColumns()`.
