---
"@zeno-lib/db": minor
---

The `drizzle-orm` peer moves to `1.0.0-rc.5-5935859`, the same build as the
`drizzle-kit` peer. Since rc.4, Drizzle drops `generatedAlwaysAsIdentity` values
from inserts, and since rc.5 an `undefined` in a `db.query.*` `where` filter
throws.
