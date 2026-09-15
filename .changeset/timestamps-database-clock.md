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
that is most writes. A `moddatetime` trigger is what maintains the column for
every writer, and pairing it with `timestamps({ onUpdate: false })` stops
Drizzle claiming ownership of a column it does not own.

No DDL changes for a default call, so this emits no migration on its own.
