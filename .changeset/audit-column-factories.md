---
"@zeno-lib/db": minor
---

Breaking: the audit column helpers in `@zeno-lib/db/schema` are functions now,
so add `()` at every use site: `...timestamps()`, `...authorship()`,
`...auditColumns()`, `createdBy: createdBy()`, `updatedBy: updatedBy()`.

They used to be plain objects, which meant every table that spread one shared a
single Drizzle column builder. Drizzle's builder methods mutate the builder and
return it, so one table calling `.unique()` or `.references()` on a spread
column changed that column on every other table too. Each call now returns
fresh builders.
