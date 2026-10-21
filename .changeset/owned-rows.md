---
"@zeno-lib/db": minor
"@zeno-lib/schema": minor
---

`ownedRows(schema, { parent })` from `@zeno-lib/schema` describes the rows of a table that belong to a parent and are edited as a list, such as an order's lines. Its `row` is what a form validates each row with: the `insert` columns without the parent's, plus the `id` of a stored row. `syncRows` from `@zeno-lib/db/query` takes it in place of the table, and checks that `parent` names exactly its parent columns.

`defineTableSchema` and `defineServerTableSchema` now return the `table` they derive from, beside `insert`, `select` and `update`.
