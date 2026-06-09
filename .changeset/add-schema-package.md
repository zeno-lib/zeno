---
"@zeno-lib/schema": minor
"@zeno-lib/db": minor
---

Add `@zeno-lib/schema`, a pure Drizzle table to Zod helper package. It peers on
`drizzle-orm@1.0.0-rc.3` and `zod>=4`, exports
`defineTableSchema(table, options?)`, returning `select`, `insert`, and
`update` Zod schemas, and re-exports Drizzle ORM's first-party Zod helpers.

Upgrade `@zeno-lib/db` to expect `drizzle-orm@1.0.0-rc.3` and
`drizzle-kit@1.0.0-rc.3` as peer dependencies, matching Drizzle's v1 schema and
Zod documentation.
