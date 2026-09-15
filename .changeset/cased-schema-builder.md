---
"@zeno-lib/db": minor
---

`schema(name)` from `@zeno-lib/db/schema` applies snake_case casing and enables
RLS, so a second schema behaves like the top-level `table` / `unsecureTable`
pair instead of like drizzle's bare `pgSchema`.

It used to be a straight re-export of `pgSchema`. The public `pgSchema(name)`
overload takes no casing argument, so every column in a second schema was named
after its TypeScript key while `table` in the same package cased them, and the
result depended on which factory built the table. Its `.table` also left RLS
off, which is the mistake `table` exists to prevent.

```ts
const billing = schema("billing")

billing.table("invoices", { ownerId: uuid() })       // "owner_id", RLS on
billing.unsecureTable("rates", { ownerId: uuid() })  // "owner_id", RLS off
```

Two things change for an existing call site. Column names in a second schema
become snake_case, so a table that relied on the verbatim key now generates a
rename; import `pgSchema` from `drizzle-orm/pg-core` directly to keep it. And
`schema(...).table` now emits `ENABLE ROW LEVEL SECURITY`; use `.unsecureTable`
for a table that intentionally has none.

Everything else on the schema is untouched: `existing()`, `enum()`, `sequence()`,
`view()` and `materializedView()` behave exactly as drizzle's do, and `isSchema`
still recognises the result.
