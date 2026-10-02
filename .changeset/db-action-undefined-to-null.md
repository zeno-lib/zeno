---
"@zeno-lib/db": minor
---

`defineAction` resolves to `null` when its handler resolves to `undefined`, and
its return type says so (`ActionValue<T>`). A read action backed by a Drizzle
`findFirst` that matched no row made TanStack Query throw "data is undefined".
An action whose handler returns nothing now resolves to `null` instead of
`undefined`.
