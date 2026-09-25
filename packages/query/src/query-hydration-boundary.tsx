import {
  type DehydrateOptions,
  dehydrate,
  QueryClient,
} from "@tanstack/react-query"
import type { ReactNode } from "react"
import { PrefetchedQueries } from "./prefetched-queries"

export type QueryHydrationBoundaryProps = {
  children: ReactNode
  /**
   * Fills the server-side cache. Call each query through the same `queryOptions` factory the
   * browser uses, unchanged, so the entry has the key *and* the value the client would build.
   * Use `fetchQuery` for a read the route cannot render without (`prefetchQuery` swallows
   * failures); everything else can be `prefetchQuery`.
   */
  prefetch: (queryClient: QueryClient) => Promise<unknown>
  /**
   * Builds the per-request `QueryClient` handed to `prefetch`. Defaults to `new QueryClient()`.
   * Pass one when your queries depend on client-level defaults (e.g. `defaultOptions.queries`).
   */
  createQueryClient?: () => QueryClient
  /** Forwarded to TanStack's `dehydrate` (e.g. to also dehydrate pending queries). */
  dehydrateOptions?: DehydrateOptions
}

/**
 * Async **server component**: runs `prefetch` against a fresh `QueryClient` and dehydrates the
 * result into `PrefetchedQueries`, so the suspense queries below resolve from the cache in the
 * server render *and* in the browser. That is what lets a `QuerySuspense` subtree render real
 * HTML instead of holding its fallback until hydration.
 *
 * ```tsx
 * <QueryHydrationBoundary
 *   prefetch={(queryClient) => queryClient.fetchQuery(dealsQueryOptions(filters))}
 * >
 *   <Deals />
 * </QueryHydrationBoundary>
 * ```
 */
export async function QueryHydrationBoundary({
  children,
  createQueryClient = () => new QueryClient(),
  dehydrateOptions,
  prefetch,
}: QueryHydrationBoundaryProps) {
  const queryClient = createQueryClient()

  await prefetch(queryClient)

  return (
    <PrefetchedQueries state={dehydrate(queryClient, dehydrateOptions)}>
      {children}
    </PrefetchedQueries>
  )
}
