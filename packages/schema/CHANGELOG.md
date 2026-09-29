# @zeno-lib/schema

## 0.2.0

### Minor Changes

- b99ed9f: `defineTableSchema` now leaves the audit columns out of `insert` and `update`:
  `createdAt`, `updatedAt`, `createdBy` and `updatedBy`, when the column has a
  default, which is what `auditColumns()`, `timestamps()` and `authorship()` from
  `@zeno-lib/db/schema` emit. A caller who sends them has them stripped rather
  than written, and the inferred types drop them too. `select` still has them.
  
  Identity columns that count up from 1, including every `sequentialPrimaryId()`,
  now only accept positive numbers in all three variants.
  
  Breaking: an `.omit({ createdAt: true, ... })` on a derived `insert` or
  `update` schema now fails, because the key is already gone. Delete those keys
  from the omit.

## 0.1.0

### Minor Changes

- 2215066: Add `@zeno-lib/schema`, a pure Drizzle table to Zod helper package. It peers on
  `drizzle-orm@1.0.0-rc.3` and `zod>=4`, exports
  `defineTableSchema(table, options?)`, returning `select`, `insert`, and
  `update` Zod schemas, and re-exports Drizzle ORM's first-party Zod helpers.

  Upgrade `@zeno-lib/db` to expect `drizzle-orm@1.0.0-rc.3` and
  `drizzle-kit@1.0.0-rc.3` as peer dependencies, matching Drizzle's v1 schema and
  Zod documentation.
