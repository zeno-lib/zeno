---
"@zeno-lib/db": patch
---

`@zeno-lib/db` ships compiled output instead of raw TypeScript.

`tsdown` now emits `dist/*.mjs` + `dist/*.d.mts` for the five entries and the
`exports` map points at them. No import specifier changes — `@zeno-lib/db`,
`/auth`, `/config`, `/schema` and `/triggers` are all still there, with the same
types. `files` keeps `src` alongside `dist`.

It was the only npm package here whose `exports` pointed at `./src/*.ts`, and
that broke it in three ordinary places at once:

- **Plain Node cannot import it.** Node's type stripping refuses files under
  `node_modules` (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`) and offers no
  flag to allow them, so a seed script, a cron entry or a one-off `node` command
  could not load the package at all.
- **Turbopack rejects it** with `Unknown module type` — a `next build` fails the
  moment anything in the graph reaches it.
- **A consumer that emits cannot typecheck against it.** Importing `.ts` needs
  `allowImportingTsExtensions`, which requires `noEmit`. A package that compiles
  to `dist` — anything using a compile-time transform, for instance — therefore
  could not use these types at all.

Only the second has a consumer-side workaround (`transpilePackages`), and it
papers over one symptom of the three.

Every peer stays external, so `drizzle-orm`, `drizzle-kit`, `postgres` and
`@supabase/supabase-js` remain bare specifiers in the output. That matters
beyond bundle size: a second copy of `drizzle-orm` would give schema entities a
different identity from the ones the consumer's own Drizzle Kit sees.
