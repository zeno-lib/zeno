---
"@zeno-lib/db": minor
---

A statement on an RLS client awaited inside `db.transaction(cb)` now runs in that transaction, even when it goes through `db` rather than `tx`, for example from a server action the callback calls. A page can load its parallel reads in one transaction by wrapping its prefetch in `db.transaction`. A `db.transaction` inside another one is now a savepoint of it, instead of a separate transaction.
