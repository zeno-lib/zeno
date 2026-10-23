---
"@zeno-lib/query": minor
---

Add a query route for reads: `createQueryRoute(queries)` from `@zeno-lib/query/query-route` builds the `POST` handler that serves a map of server functions, and `createQueryCaller` from `@zeno-lib/query/query-caller` builds the typed `callQuery(name, input, context)` a `queryFn` calls. Each call is its own request, so queries run in parallel and TanStack's `signal` aborts them, and values travel through `devalue`. `QueryHydrationBoundary` takes the same map as `queries`, so a prefetch runs them in-process.
