---
"@zeno-lib/db": minor
---

The `drizzle-orm` and `drizzle-kit` peers move to `1.0.0-rc.5`, the tagged release that
follows the `1.0.0-rc.5-5935859` build. Drizzle now passes `json`, `jsonb` and date
parameters to postgres-js's own serializers, so drop any manual `JSON.stringify` around a
JSON parameter in raw SQL. `DrizzleQueryError` no longer carries the query's parameters
unless the client sets `paramsInErrors`. `db.execute(sql)` without a row type now returns the
raw result, and `QueryExecutor`, which `selectFunctionPermissions` takes, asks for
`execute(query, "objects")`: a Drizzle client or transaction still fits, but a hand-written
executor needs the second parameter.
