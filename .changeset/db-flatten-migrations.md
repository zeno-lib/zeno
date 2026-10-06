---
"@zeno-lib/db": minor
---

`defineDrizzleConfig` now moves each generated migration to where the Supabase CLI reads it.
Set `moveGeneratedSql: false` to keep Drizzle Kit's layout.

Apply migrations with the Supabase CLI.

Switching from `drizzle-kit migrate`:

1. Run `db:generate` once. It moves the existing migrations.
2. Run `supabase migration repair --status applied <version...>` on each database that already has them. Otherwise `supabase db push` runs them all again.
