---
"@zeno-lib/query": patch
---

New package: TanStack Query components for server-rendered apps. `QuerySuspense` stacks the reset boundary, an error boundary and `Suspense`, and holds its `fallback` until hydration so a query over a Server Function never runs in the initial server render. `QueryHydrationBoundary` is an async server component that runs a `prefetch(queryClient)` callback and dehydrates the result into `PrefetchedQueries`, which lets the `QuerySuspense` subtree below it server-render. Also ships `QuerySuspenseLoading` (an accessible skeleton root) and the `query-defaults` timing presets. The matching error card is a registry item: `shadcn add zeno-lib/zeno/query-error-fallback`.
