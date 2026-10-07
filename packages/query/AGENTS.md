# `@zeno-lib/query`

Suspense and SSR-prefetch components for [TanStack Query](https://tanstack.com/query). The user guide
is in [`data-management/queries`](../../apps/docs/content/docs/core-framework/data-management/queries.mdx).

## Rules

- **Everything on npm is UI-free.** `query-error-fallback.tsx` renders shadcn's `Button`, so it ships
  through the registry only: it is not a tsdown entry and not in `files`. Never import
  `@/components/ui/*` from an npm entry.
- **No root `index.ts` barrel.** The hydration boundary is a server component and the rest are
  `"use client"` modules; per-file entries keep each directive in `dist/`.
- **Never turn the prefetch flag into a prop.** `PrefetchedQueries` derives it from
  `state.queries.length > 0`, so nothing opens the gate without filling the cache.
- **Never drop the hydration gate in `QuerySuspense`.** A `queryFn` that calls a Server Function
  throws during the server render; without the gate the server renders `errorFallback` and React
  re-renders the subtree.
- **Before hydration, return `fallback` alone**, never a swapped child. A suspending update keeps the
  old children mounted beside the fallback, which doubles the skeleton.
- **Keep `@tanstack/*` and `react*` in tsdown's `deps.neverBundle`.** A bundled copy splits the
  contexts.

## Traps

- **The gate opens for the whole subtree.** A suspense query under a filled `PrefetchedQueries` that
  was not prefetched runs its `queryFn` during the server render.
- **`prefetchQuery` swallows failures**, leaving a gap that renders `errorFallback` on the server.
  Use `fetchQuery` for a read the route can't render without.
- **Prefetch through the browser's own `queryOptions` factory, unchanged.** A spread with a replaced
  `queryFn` risks a different key or value, and the client refetches.
- **The error boundary rethrows errors whose `digest` starts with `NEXT_`**, so `notFound()` and
  `redirect()` reach Next's boundaries.
- **`debugState` is gated on `NODE_ENV !== "production"`** and left for the consumer's bundler.
  Keep it off committed call sites.
- **Build with `tsconfig.build.json`.** The main `tsconfig.json` includes the registry file and the
  tests, which reach `packages/ui` through `paths`, and tsdown would emit `.d.ts` files into
  `packages/ui/src`.
