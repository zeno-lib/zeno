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
- **Detect audit columns by key and default**, so a plain `pgTable` gets the same omit.
- **Read column markers from the table's `"~zeno"` key, never from the column types.** Drizzle's
  `MakeColumnConfig` copies a fixed set of builder fields, so a marker on a builder never reaches
  the column types. `table()` from `@zeno-lib/db/schema` reads it off the builders and records it,
  type and value, on the table. An omit the inferred type doesn't also make offers a key the
  runtime strips; `packages/db/src/column-rules.test.ts` and `.test-d.ts` pin both sides.
- **`COLUMN_RULES_KEY` in `src/index.ts` mirrors `@zeno-lib/db/schema`.** Rename both together,
  along with the rule shapes (`serverOwned`, `refine`).
- **`AUDIT_COLUMN_KEYS` in `src/index.ts` mirrors `@zeno-lib/db/schema`.** Rename both together;
  `packages/db/src/schema-zod.test.ts` fails if they drift.
- **Never point `exports` back at `src/`.** A consumer's Next build doesn't transpile
  `node_modules` and fails with "Unknown module type". `dist/` is gitignored and built by
  `prepack`.

## Traps

- **Drizzle types a function refinement on an insert column as required.** `OptionalRefinedInsert`
  restores `.optional()` for a nullable or defaulted column. Keep it until Drizzle's
  `HandleRefinement` does the same.
- **Option refinements are per variant.** A rule under `insert` doesn't reach `select` or
  `update`. A column rule reaches `insert` and `update`, never `select`, and a caller's function
  refinement for the same column receives the rule's schema.
- **Identity columns leave `insert` and `update`**, `by default` ones included. In `select`, those
  counting from 1 get `.positive()`, and a function refinement on one receives the positive schema.
