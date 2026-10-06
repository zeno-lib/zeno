---
"@zeno-lib/forms": patch
---

The headless entries (`@zeno-lib/forms`, `@zeno-lib/forms/lib/*` and
`@zeno-lib/forms/tanstack`) now ship compiled `dist/*.mjs` with `.d.mts` types,
and `exports` points at them. They used to export `src/*.ts`, which a Next.js
build fails to load with "Unknown module type" unless the app lists
`@zeno-lib/forms` in `transpilePackages`. That workaround is no longer needed.
`./create-form` and `./form-dialog` still export their registry-shaped source.
