# `@zeno-lib/schema`

`defineTableSchema(table, options?)` and the `drizzle-orm/zod` re-exports, for deriving Zod schemas
from Drizzle tables. The user guide is in
[`data-management/schemas`](../../apps/docs/content/docs/core-framework/data-management/schemas.mdx).

## Rules

- **Never import `@zeno-lib/db`.** This package must stay pure and client-safe, so importing a
  validation schema never pulls in `postgres-js` or server code.
- **Never re-export `z`.** Consumers import it from `zod`, so the peer stays visible.
- **Don't generate form schemas** (`createForm`, `editForm`). Forms are product workflows that users
  derive from the DB variants themselves.
- **Don't add a stricter unknown-key policy.** Generated columns are omitted and unknown keys are
  stripped, as plain Zod does.
- **Detect audit columns by key and default, never by a runtime marker.** Drizzle's
  `MakeColumnConfig` copies a fixed set of builder fields, so a brand from `@zeno-lib/db` never
  reaches the column types, and a marker-based omit would strip a key the inferred type still offers.
- **`AUDIT_COLUMN_KEYS` in `src/index.ts` mirrors `@zeno-lib/db/schema`.** Rename both together;
  `packages/db/src/schema-zod.test.ts` fails if they drift.
- **Never point `exports` back at `src/`.** A consumer's Next build doesn't transpile
  `node_modules` and fails with "Unknown module type". `dist/` is gitignored and built by
  `prepack`.

## Traps

- **Drizzle types a function refinement on an insert column as required.** `OptionalRefinedInsert`
  restores `.optional()` for a nullable or defaulted column. Keep it until Drizzle's
  `HandleRefinement` does the same.
- **Refinements are per variant.** A rule under `insert` doesn't reach `select` or `update`.
- **Identity columns counting from 1 get `.positive()` in every variant**, and a function refinement
  on one receives the positive schema.
