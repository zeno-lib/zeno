---
"@zeno-lib/db": minor
"@zeno-lib/schema": minor
---

The audit helpers mark their own columns. `timestamps()`, `createdBy()` and `updatedBy()`, so also `authorship()` and `auditColumns()`, record that the database writes them, and `defineTableSchema` leaves them out of `insert` and `update` under any key.

**Breaking:** `defineTableSchema` no longer recognises audit columns by name. A column named `createdAt`, `createdBy`, `updatedAt` or `updatedBy` that you declare yourself, with a default, is now writable. Build it with the helper, or wrap it in `serverOwned()`, to keep it out of writes.

`authUserId({ defaultToCurrentUser: true })` declares an owner column: `DEFAULT auth.uid()`, marked server-owned so no client picks the owner. `serverOwned()` on an audit column is a type error, and throws.
