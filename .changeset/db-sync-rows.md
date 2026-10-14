---
"@zeno-lib/db": minor
---

A form that edits a parent with its child rows can save them in one call.
`syncRows(db, table, { parent, rows })`, from `@zeno-lib/db/query`, makes
`rows` the parent's whole set of rows: it removes the stored rows that left the
list first, so a removed key can come straight back, then updates the rows still
in it and inserts the new ones. It resolves to the saved rows in input order, so
the form can take up the new ids.

- `parent` (`{ orderId }`) scopes every read, update and removal, and is
  written onto every row, so another parent's rows are never touched. At least
  one parent value must not be `null`.
- Rows are told apart by their `id`, or by natural key columns with `key`, where
  a `null` key part matches a stored `null`. An id the parent doesn't hold is
  inserted as a new row, keeping the id when its column has no default.
- An update sets only the columns a row carries and changes, so an untouched
  row isn't written. Two rows with the same key reject before anything is
  written.
- `remove` takes over from the delete, to soft-delete or unlink the removed
  rows.
- It runs in `db.transaction`, a savepoint inside a `tx`, so a failure undoes
  only the sync's own writes.
