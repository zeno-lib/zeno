---
"@zeno-lib/query": minor
---

`callQuery` now reloads the page when the route answers that it no longer serves the query, at most once a minute, as it already does on a redirect. That `404` means the page runs an older bundle than the server: a tab opened before a deploy removed or renamed the query, which skew protection does not catch for a plain `fetch`. The route marks its own `404` with an `x-query-missing` header, so a host's `404` page or a wrong `path` still rejects with a `QueryRequestError` and no reload. Rename a query when its input changes in a way the old input fails, so an open tab reloads instead of failing every refetch.
