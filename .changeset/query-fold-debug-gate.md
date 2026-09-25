---
"@zeno-lib/query": patch
---

`QuerySuspense`'s `debugState` gate reads `process.env.NODE_ENV` bare, so bundlers fold it and drop the debug branch from production builds. The previous `typeof process` guard kept it in client bundles.
