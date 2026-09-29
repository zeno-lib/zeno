---
"@zeno-lib/schema": patch
---

The package now ships compiled `dist/index.mjs` and `dist/index.d.mts`, and
`exports` points at them. It used to export `src/index.ts`, which bundlers that
do not transpile `node_modules`, Next.js included, fail to load with "Unknown
module type".
