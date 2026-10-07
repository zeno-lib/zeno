---
"@zeno-lib/db": patch
"@zeno-lib/forms": patch
"@zeno-lib/query": patch
"@zeno-lib/supabase": patch
"@zeno-lib/test": patch
---

Lint fixes for Biome 2.5 and Ultracite 7.12, with no behavior change.
`ActionSchema.parse` and the `RlsTestHarness` members are now declared as
function-typed properties instead of methods.
