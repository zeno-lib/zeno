---
"@zeno-lib/schema": minor
---

**Breaking:** `defineTableSchema` takes only a table from `table`, `unsecureTable` or `schema(...).table` in `@zeno-lib/db/schema`. A plain drizzle `pgTable`, or a table from the re-exported `tableCreator`, is now a type error and throws at runtime, where its column markers used to be ignored without a trace. Derive a plain table's schemas with the re-exported `createInsertSchema`, `createSelectSchema` and `createUpdateSchema`.
