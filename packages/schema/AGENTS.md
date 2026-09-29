# `@zeno-lib/schema` — Intent

Pure schema helpers for deriving Zod schemas from Drizzle tables. Inherits root
workspace conventions; this package is intentionally shared-runtime and does
not own database connections, migrations, or UI components.

## Purpose & Scope

Provides the Zeno convention for table-derived validation schemas:
`defineTableSchema(table, options?)` returns `{ select, insert, update }` using
Drizzle ORM's first-party `drizzle-orm/zod` helpers.

**Owns:** the `defineTableSchema` convenience API, Drizzle Zod helper
re-exports, and type tests proving generated schemas stay compatible with Zod
and Standard Schema consumers such as `@zeno-lib/forms`.

**Does NOT own:** Drizzle runtime clients, Drizzle Kit CLI/migrations, Postgres
connections, RLS claims, or form UI. Runtime clients and config presets remain
in `@zeno-lib/db`; the Drizzle packages themselves stay consumer-owned peers.
Forms remain in `@zeno-lib/forms`.

## Entry Points & Contracts

| Import | Use from | Returns / does |
|---|---|---|
| `@zeno-lib/schema` | Shared schema modules, Server Actions, Route Handlers, Client Components that need validation | `defineTableSchema(table, options?)` returns Zod `select`, `insert`, and `update` schemas for a Drizzle table. Also re-exports `createSelectSchema`, `createInsertSchema`, `createUpdateSchema`, and `createSchemaFactory` from `drizzle-orm/zod`. |

`insert` and `update` omit the audit columns: a key in `createdAt`,
`updatedAt`, `createdBy`, `updatedBy` whose column has a default. Runtime and
types apply the same key-and-default rule, so they never disagree. Identity
columns counting up from 1 (every `sequentialPrimaryId()`) get `.positive()` in
all three variants.

`options.select`, `options.insert`, and `options.update` are the same refinement
maps accepted by Drizzle's first-party Zod helpers, minus the omitted audit
keys. A function refinement on an identity column receives the positive
schema; a schema value replaces it. `options.factory` passes
through to `createSchemaFactory(...)` for advanced coercion/custom Zod-instance
cases.

The package peers on `drizzle-orm` and `zod`; it deliberately does not depend on
`@zeno-lib/db` so importing validation schemas never pulls in `postgres-js` or
server-only client code.

## Usage Patterns

Keep table modules pure and derive validation schemas next to the table:

```ts
import { defineTableSchema } from "@zeno-lib/schema"
import { snakeCase } from "drizzle-orm/pg-core/casing"
import { text, uuid } from "drizzle-orm/pg-core"

const pgTable = snakeCase.table

export const posts = pgTable("posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull(),
  title: text("title").notNull(),
})

export const postSchema = defineTableSchema(posts, {
  insert: {
    title: (schema) => schema.min(3),
  },
})
```

Derive product-specific schemas explicitly with Zod composition:

```ts
import { z } from "zod"
import { postSchema } from "./schema"

export const createPostFormSchema = postSchema.insert
  .omit({ slug: true })
  .extend({ publishNow: z.boolean().default(false) })
```

## Anti-patterns

- **Do not import `@zeno-lib/db` root helpers here.** This package must stay
  pure and client-safe. Import Drizzle table builders directly from Drizzle in
  consuming schema modules.
- **Do not add generated `createForm` or `editForm` schemas by default.** Forms
  are product workflows; users should derive them explicitly from the DB
  variants with Zod.
- **Do not re-export `z` from this package.** Consumers import `z` from `zod` so
  the peer dependency stays visible.
- **Do not wrap Drizzle Zod behavior with stricter unknown-key policy.** Generated
  insert/update schemas omit generated columns; plain Zod object parsing strips
  unknown keys unless the user opts into stricter behavior themselves.

- **Do not detect audit columns by a runtime marker.** Drizzle's
  `MakeColumnConfig` copies a fixed set of builder fields, so a brand set by
  `@zeno-lib/db` never reaches the table's column types. A marker-based omit
  would strip a key the inferred type still offers. The key-and-default rule is
  the one both sides can see.

## Dependencies & Edges

Peer deps: `drizzle-orm 1.0.0-rc.3`, `zod >=4`. Dev deps:
`@zeno-lib/typescript`, `drizzle-orm`, `tsdown`, `typescript`, `vitest`, `zod`.

Build: `tsdown` bundles `src/index.ts` to `dist/`, with both peers kept
external. `dist/` is gitignored and built by `prepack`, like `@zeno-lib/db`,
because nothing imports this package during `pnpm dev`.

Used by: apps and packages that want a single Zod schema lineage from Drizzle
tables to server validation and `@zeno-lib/forms`.

Coexists with `@zeno-lib/db`: `@zeno-lib/db` owns database runtime helpers and
the Drizzle Kit config preset; `@zeno-lib/schema` owns pure validation helpers.

## Pitfalls

- **Never point `exports` back at `src/`.** Vitest and `tsc` load TypeScript
  source fine, but a consumer's Next.js build does not transpile
  `node_modules` and fails with "Unknown module type".

- **The audit key list mirrors `@zeno-lib/db/schema`.** Renaming a key there
  must change `AUDIT_COLUMN_KEYS` in `src/index.ts`; `db/src/schema-zod.test.ts`
  runs the real helpers through `defineTableSchema` and fails if they drift.

- **Generated columns are omitted, not strict-rejected.** Drizzle's Zod helpers
  build normal `z.object(...)` schemas, so unknown keys are stripped by default.
- **Drizzle types a function refinement on an insert column as required.**
  `OptionalRefinedInsert` in `src/index.ts` restores `.optional()` for a
  nullable or defaulted column, matching the runtime. Keep it until Drizzle's
  `HandleRefinement` does the same.
- **Refinements are per variant.** A refinement under `insert` does not affect
  `select` or `update`; repeat a rule when the same validation belongs in more
  than one variant.
- **Keep DB clients out of shared schema modules.** A Client Component can import
  a Zod schema only if the module graph stays free of server-only code.
