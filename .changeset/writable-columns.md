---
"@zeno-lib/schema": minor
---

`writableColumns(exports)` lists, for every Zeno table among a module's exports, the columns `defineTableSchema`'s `insert` and `update` accept, keyed by table name. Snapshot it in one test, so a column that becomes writable shows up as a diff in review.
