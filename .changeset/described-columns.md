---
"@zeno-lib/db": minor
"@zeno-lib/schema": minor
---

Describe a column once, on the table. `described(builder, description)` from `@zeno-lib/db/schema` records what a column holds without changing its SQL, and `defineTableSchema` puts the description on the column's `insert`, `update` and `select` schemas, so their JSON Schema carries it, and so does a schema picked from them. `columnDescription(table, key)` from `@zeno-lib/schema` reads it back for a schema built anew around the column, such as `z.array(...)`.
