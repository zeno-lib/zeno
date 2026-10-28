# @zeno-lib/query

## 0.1.1

### Patch Changes

- 8b5653b: Lint fixes for Biome 2.6 and Ultracite 8, with no change in behavior: regular expressions
  take the `u` flag and a capture group nothing reads is gone.

## 0.1.0

### Minor Changes

- eb58a33: Add a query route for reads: `createQueryRoute(queries)` from `@zeno-lib/query/query-route` builds the `POST` handler that serves a map of server functions, and `createQueryCaller` from `@zeno-lib/query/query-caller` builds the typed `callQuery(name, input, context)` a `queryFn` calls. Each call is its own request, so queries run in parallel and TanStack's `signal` aborts them, and values travel through `devalue`. `QueryHydrationBoundary` takes the same map as `queries`, so a prefetch runs them in-process.

## 0.0.3

### Patch Changes

- 707eaf0: Lint fixes for Biome 2.5 and Ultracite 7.12, with no behavior change.
  `ActionSchema.parse` and the `RlsTestHarness` members are now declared as
  function-typed properties instead of methods.

## 0.0.2

### Patch Changes

- 3dad51e: `QuerySuspense`'s `debugState` gate reads `process.env.NODE_ENV` bare, so bundlers fold it and drop the debug branch from production builds. The previous `typeof process` guard kept it in client bundles.

## 0.0.1

### Patch Changes

- 1472159: New package: TanStack Query components for server-rendered apps. `QuerySuspense` stacks the reset boundary, an error boundary and `Suspense`, and holds its `fallback` until hydration so a query over a Server Function never runs in the initial server render. `QueryHydrationBoundary` is an async server component that runs a `prefetch(queryClient)` callback and dehydrates the result into `PrefetchedQueries`, which lets the `QuerySuspense` subtree below it server-render. Also ships `QuerySuspenseLoading` (an accessible skeleton root) and the `query-defaults` timing presets. The matching error card is a registry item: `shadcn add zeno-lib/zeno/query-error-fallback`.
