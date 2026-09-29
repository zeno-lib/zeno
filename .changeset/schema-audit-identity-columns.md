---
"@zeno-lib/schema": minor
---

`defineTableSchema` now leaves the audit columns out of `insert` and `update`:
`createdAt`, `updatedAt`, `createdBy` and `updatedBy`, when the column has a
default, which is what `auditColumns()`, `timestamps()` and `authorship()` from
`@zeno-lib/db/schema` emit. A caller who sends them has them stripped rather
than written, and the inferred types drop them too. `select` still has them.

Identity columns that count up from 1, including every `sequentialPrimaryId()`,
now only accept positive numbers in all three variants.

Breaking: an `.omit({ createdAt: true, ... })` on a derived `insert` or
`update` schema now fails, because the key is already gone. Delete those keys
from the omit.
