---
"@zeno-lib/schema": minor
---

`defineServerTableSchema(table, options?)` is `defineTableSchema` for code that runs only on the server, such as a sync job: its `insert` and `update` keep the columns `serverOwned()` keeps from clients. Identity and audit columns stay out, as the database writes them: an upsert keyed on the id extends the schema with `select.shape.id`. Never parse a client's payload with it.
