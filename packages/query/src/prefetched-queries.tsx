"use client"

import { type DehydratedState, HydrationBoundary } from "@tanstack/react-query"
import { createContext, type ReactNode, useContext } from "react"

/**
 * True inside a subtree that was handed a filled dehydrated cache.
 *
 * `QuerySuspense` reads it to skip the gate that otherwise keeps a suspense query off the server
 * render. It is **derived from the payload**, not passed as a flag, so nothing can opt in without
 * having prefetched: the only way to make it true is to arrive here with cache entries.
 *
 * What it does *not* promise is that every query below was prefetched. One that was not still runs
 * its `queryFn` during the server render, so a route that opts in has to prefetch every suspense
 * query its **server pass** reaches.
 */
const PrefetchedQueriesContext = createContext(false)

/** Whether the nearest `PrefetchedQueries` above was handed at least one dehydrated query. */
export function useHasPrefetchedQueries(): boolean {
  return useContext(PrefetchedQueriesContext)
}

export type PrefetchedQueriesProps = {
  children: ReactNode
  state: DehydratedState
}

/**
 * TanStack's `HydrationBoundary` plus the flag above. It hydrates `state` into the cache **during
 * render** (on the server pass as well as in the browser), so a `useSuspenseQuery` below it
 * resolves synchronously in both and the two passes produce the same markup.
 */
export function PrefetchedQueries({ children, state }: PrefetchedQueriesProps) {
  return (
    <HydrationBoundary state={state}>
      <PrefetchedQueriesContext.Provider value={state.queries.length > 0}>
        {children}
      </PrefetchedQueriesContext.Provider>
    </HydrationBoundary>
  )
}
