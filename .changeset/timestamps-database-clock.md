---
"@zeno-lib/db": minor
---

`timestamps()` stamps `updated_at` from the database clock and takes options.

The refresh hook used to be `$onUpdate(() => new Date())`, which returns a
JavaScript value, so Drizzle bound it as a parameter and `updated_at` came from
whichever Node process ran the write while `created_at` came from
`DEFAULT now()`. The two columns on one row could disagree. It is
`$onUpdateFn(() => sql`now()`)` now: Drizzle inlines a SQL result into the
statement, so Postgres supplies both values.

```sql
UPDATE "posts" SET "title" = $1, "updated_at" = now() WHERE ...
```

Three options, forwarded by `auditColumns()`:

| Option | Default | What it changes |
|---|---|---|
| `onUpdate` | `true` | Whether Drizzle refreshes `updated_at` on a write. |
| `withTimezone` | `true` | `timestamptz` or `timestamp`. |
| `precision` | none | Fractional-second digits, 0 to 6. |

`onUpdate: false` is for a column a trigger owns. The hook only runs for writes
that go through Drizzle: a write arriving through PostgREST (the `supabase-js`
client, the dashboard, any REST caller) never runs it, and in a Supabase app
that is most writes.

For those, a new `@zeno-lib/db/triggers` entrypoint returns the SQL that makes
Postgres maintain the column instead:

```ts
import { updatedAtTrigger } from "@zeno-lib/db/triggers"

console.log(updatedAtTrigger(posts))
```

Drizzle Kit emits no trigger DDL and triggers are not part of its snapshot
format, so the route is `drizzle-kit generate --custom`, which writes an empty
migration that is still tracked (its snapshot links into the chain). Paste the
SQL in, then pass `timestamps({ onUpdate: false })` so one mechanism owns the
column. `updatedAtTrigger` reads the table's real name and schema, takes
`column` / `name` / `schema` / `extensionSchema` / `createExtension`, accepts a
plain table name, and emits re-runnable SQL.

No DDL changes for a default call, so the column definitions emit no migration
on their own.
