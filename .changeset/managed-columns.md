---
"@zeno-lib/db": minor
"@zeno-lib/schema": patch
---

`serverOwned` is now `serverManaged`, and `databaseManaged` marks a column only the database writes. A `serverManaged` column leaves the client `insert` and `update`, and `defineServerTableSchema` keeps it for the server code that sets it, as before. A `databaseManaged` column, one a trigger, a default or a database function sets, leaves both, so no input, server-side ones included, accepts a value the database would overwrite. The audit columns of `timestamps()` and `authorship()` already carry it. A column a trigger and server code both write stays `serverManaged`. Neither changes the DDL.

Rename every `serverOwned(` to `serverManaged(`, then move the columns only the database writes to `databaseManaged(`.
