---
"@zeno-lib/db": patch
---

`syncRows` ends with the listed values when a delete trigger rewrites the rows
it keeps, and saves a parent's thousands of rows in a few statements.

- A delete trigger that rewrites the rows left, such as one that hands a removed
  member's share to the others, no longer leaves its values on a kept row whose
  listed value is the one the sync read before the removal. The sync reads the
  parent's rows again once it has removed any, and compares the listed rows with
  those. That costs one more read, only when something was removed. A change
  `remove` makes to the rows left counts the same way.
- New rows are inserted many to a statement, and removed rows deleted many to a
  statement, split to stay under the bind parameter limit: 20,000 new rows take
  two inserts instead of 20,000. Removing rows by a key of several columns no
  longer builds an `OR` that Postgres takes seconds to plan past a few thousand
  rows. Each kept row that changed is still one update.
- The updates now run before the inserts, so a new row can take a unique value a
  kept row gives up, wherever it sits in the list.
