---
"@zeno-lib/db": minor
---

The RLS clients run the statements awaited in the same task in one
transaction, so parallel reads such as `Promise.all([db.select()…, db.select()…])`
open one transaction with one claims statement instead of one each. The
statements stay independent: when one fails, the transaction rolls back and
each statement runs again in a transaction of its own, so only the failing one
rejects. `createAuthClient` now verifies claims once per transaction rather
than once per statement. `db.transaction(cb)` is unchanged.
