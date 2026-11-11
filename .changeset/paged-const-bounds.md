---
"@zeno-lib/db": patch
---

`defineQuery({ paged: BOUNDS, … })` with `BOUNDS` declared `as const` now types `run`'s `limit` and `offset`. TypeScript used to pick the non-paged overload for it, so the input lost both.
