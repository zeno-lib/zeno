---
"@zeno-lib/db": minor
---

Add the query and error helpers Drizzle has no equivalent for, and two options on existing helpers.

- New `@zeno-lib/db/query` entry: `one` / `maybeOne` (PostgREST's `.single()` / `.maybeSingle()`), `excludedSet` + `definedValues` (the `onConflictDoUpdate` set that reproduces `.upsert()`: supplied, non-`undefined` columns only, never the conflict target, `id = excluded.id` when empty; `target` names another conflict target), and `functionPermissionTables` + `selectFunctionPermissions`, which ask the four `functionPolicies` functions for one table in a single statement.
- New `@zeno-lib/db/errors` entry: `SqlState`, `toPostgresError` (unwraps Drizzle's `DrizzleQueryError` to the postgres.js error carrying the SQLSTATE) and `isConstraintViolation(error, constraints?, { code? })`.
- `timestamps()` and `auditColumns()` take `mode: "date" | "string"`. The default is unchanged (`"date"`); `"string"` reads Postgres's text form and keeps microseconds.
- The client factories take `requirePooler`, and `resolveDatabaseUrl` is exported from the root. With `requirePooler: true` a URL whose port is not `6543`, or whose host is local, throws at client creation. The default (`false`) keeps today's behaviour.
