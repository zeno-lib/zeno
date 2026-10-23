---
"@zeno-lib/db": minor
---

Add `defineQuery` to `createRequestDb`. It wraps a read like `defineAction` does, for a module without `"use server"` whose exports a query route serves, so the browser runs a screen's reads in parallel instead of queuing them as server actions.
