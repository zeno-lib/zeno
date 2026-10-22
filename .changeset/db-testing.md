---
"@zeno-lib/db": minor
---

Tests on a shared database can write rows that never commit, and assert that a
query fails with a given SQLSTATE. `@zeno-lib/db/testing` is a new entry with
three helpers, which throw instead of calling `expect`, so any test runner can
use them.

- `rollBackAfter(db, run)` runs `run` in a transaction that always rolls back,
  and resolves to what `run` returned. `run` gets the transaction type
  `db.transaction` hands its callback, relations included. An error it throws,
  `tx.rollback()` included, is rethrown. On a transaction, it runs in a
  savepoint.
- `expectPostgresError(query, code)` resolves to the `PostgresError` under
  Drizzle's wrapper when the query fails with that SQLSTATE. It rejects when the
  query succeeds, when it fails with another code, and when the error didn't come
  from the server. It takes the query, or a function that starts it.
- `expectRlsDenied(query)` is `expectPostgresError` for `insufficient_privilege`
  (`42501`), what a row-level security policy or a missing grant raises.
