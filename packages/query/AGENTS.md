# `@zeno-lib/query`: Intent

Suspense and SSR-prefetch components for [TanStack Query](https://tanstack.com/query). Inherits
root conventions; this file documents the hydration gate and the prefetch contract, which no single
file makes obvious.

**Distribution split.** Everything on npm is UI-free (React + TanStack only). The one UI-coupled
piece, `query-error-fallback.tsx` (renders shadcn's `Button`), ships via the **registry**
(`shadcn add zeno-lib/zeno/query-error-fallback`, dropped into `@/components/query/`). It is authored
in the consumer dialect (`@/components/ui/button`, `@/lib/utils`) and imports its props type from
`@zeno-lib/query/query-suspense`, so the registry item lists `@zeno-lib/query` as an npm dependency.
It is **not** a tsdown entry and not in `files`.

## Purpose & Scope

**Owns:** the suspense boundary with its hydration gate (`QuerySuspense`), the async server
prefetch boundary (`QueryHydrationBoundary`), the dehydrated-payload context (`PrefetchedQueries` /
`useHasPrefetchedQueries`), the accessible loading root (`QuerySuspenseLoading`), the timing presets
(`query-defaults`), and the registry error card.

**Does NOT own:** the app's `QueryClientProvider` or its global error handling (toasts, telemetry,
`meta` flags), query key conventions, or what a `queryFn` calls. `QueryHydrationBoundary` knows
nothing about databases or request context: the caller's `prefetch` closure brings its own.

## Entry Points & Contracts

**npm** (subpath exports only, no root barrel: the boundary is a server component and the others are
`"use client"` modules, and per-file entries keep each directive intact in `dist/`):

| Import | Provides |
|---|---|
| `@zeno-lib/query/query-suspense` | `QuerySuspense`, types `QuerySuspenseProps`, `QuerySuspenseErrorFallbackProps` (`{ error, onRetry }`), `QuerySuspenseDebugState` (client) |
| `@zeno-lib/query/query-hydration-boundary` | `QueryHydrationBoundary` (async server component), `QueryHydrationBoundaryProps`: `prefetch(queryClient) => Promise<unknown>`, optional `createQueryClient()`, `dehydrateOptions` |
| `@zeno-lib/query/prefetched-queries` | `PrefetchedQueries({ state })`, `useHasPrefetchedQueries()` (client) |
| `@zeno-lib/query/query-suspense-loading` | `QuerySuspenseLoading` (`div` props, `aria-busy`/`aria-live` defaults) |
| `@zeno-lib/query/query-defaults` | `liveBackgroundQueryDefaults`, `liveQueryDefaults`, `shortLivedQueryDefaults`, `longLivedQueryDefaults`, `cachedQueryDefaults`, `staticQueryDefaults` (milliseconds) |

**Registry:** `query-error-fallback` → `QueryErrorFallback` (`QuerySuspenseErrorFallbackProps` +
`div` props + `fallbackMessage`, `message`, `messageClassName`, `retryLabel`, `hideRetry`,
`retryButtonProps`, `buttonOnly`, `children`).

## Usage Patterns

Consumer-facing guide:
[`apps/docs/.../data-management/queries.mdx`](../../apps/docs/content/docs/core-framework/data-management/queries.mdx).
The short version: every `useSuspenseQuery` sits in a `QuerySuspense`; a route that wants server
HTML wraps its tree in `QueryHydrationBoundary` and prefetches each suspense query its server pass
reaches, through the same `queryOptions` factory the browser uses.

## Anti-patterns

- **Don't turn the prefetch flag into a prop.** `PrefetchedQueries` derives it from
  `state.queries.length > 0` so nothing can open the gate without having filled the cache. A
  `serverRender` boolean would let a route opt in with nothing prefetched and ship an error card.
- **Don't drop the hydration gate** in `QuerySuspense` "because the query works in the browser". A
  `queryFn` that calls a Server Function throws during the initial server render; without the gate
  the server renders `errorFallback`, the client suspends, and React re-renders the subtree.
- **Don't swap the boundary's child instead of returning `fallback` alone before hydration.** A
  suspending *update* keeps the old children mounted-but-hidden beside the fallback: two copies of
  the skeleton in the DOM.
- **Don't add a root `index.ts` barrel** that mixes the server boundary with the client modules.
- **Don't import `@/components/ui/*` from any npm entry.** UI-coupled code goes to the registry.

## Dependencies & Edges

Peers: `@tanstack/react-query >=5`, `react >=19`. No `next` dependency: the only Next-specific
behaviour is that the error boundary rethrows errors whose `digest` starts with `NEXT_` (so
`notFound()` / `redirect()` reach Next's own boundaries), which is a string check.
`tsdown.config.ts` keeps `@tanstack/*` and `react*` external, since a bundled copy would split the
contexts. `@zeno-lib/ui` is a devDependency only, as the alias target (tsconfig `paths`) for typechecking
and testing the registry item. `dist/` is committed (see `.gitignore` and
`.github/workflows/bundle-packages.yml`).

## Pitfalls

- **The gate opens for the whole subtree.** Inside a filled `PrefetchedQueries`, a suspense query
  that was *not* prefetched runs its `queryFn` during the server render. Components the server pass
  doesn't render (an unmounted inactive tab, a closed dialog) are fine.
- **`prefetchQuery` swallows failures**, so a failed prefetch leaves a gap that renders
  `errorFallback` on the server. Use `fetchQuery` for the read the route can't render without.
- **The prefetch must go through the browser's own `queryOptions` factory**, unchanged; a spread
  with a replaced `queryFn` risks a different key or value, so the client refetches.
- **`debugState` is gated on `process.env.NODE_ENV !== "production"`**, left as-is in `dist/` for
  the consumer's bundler to replace. Keep it off committed call sites.
- **Build uses `tsconfig.build.json`.** The main `tsconfig.json` includes the registry file and the
  tests, which reach `packages/ui` through `paths`; putting them in the dts program makes tsdown emit
  `.d.ts` files into `packages/ui/src`.
