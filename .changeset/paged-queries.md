---
"@zeno-lib/db": minor
---

Page a list with `findPage` and `mapPage` from `@zeno-lib/db/query`, which read one page of a relational query, relations included, with how many rows match in all (`{ items, total, hasMore }`), on any page. The object form of `defineQuery` takes `paged: true` (or `{ defaultLimit, maxLimit, maxOffset }`), which adds `limit` and `offset` to the schema and to the JSON Schema a tool list shows, checks them before `run`, and requires `run` to resolve to a `Page`.
