"use client"

import { QueryErrorResetBoundary } from "@tanstack/react-query"
import type { ReactNode } from "react"
import { Component, Suspense, useSyncExternalStore } from "react"
import { useHasPrefetchedQueries } from "./prefetched-queries"

// A bare `process.env.NODE_ENV` read, so bundlers replace it with a literal and
// drop the debug branch from production builds. A `typeof process` guard would
// keep it: the bundler cannot fold that.
const debugStateEnabled = process.env.NODE_ENV !== "production"

const subscribeToNothing = () => () => {
  /* the value never changes after mount, so there is nothing to unsubscribe */
}

/* False on the server and through hydration, true from the first client render after it. */
const useIsHydrated = () =>
  useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )

const debugError = Object.freeze(
  new Error(
    'QuerySuspense: debugState="error" (development / test only; for screenshots)'
  )
)

const noop = () => {
  /* no-op: the debug error state has nothing to retry */
}

export type QuerySuspenseErrorFallbackProps = {
  error: Error
  onRetry: () => void
}

type QueryErrorBoundaryProps = {
  children: ReactNode
  errorFallback: (props: QuerySuspenseErrorFallbackProps) => ReactNode
  onQueryReset: () => void
}

type QueryErrorBoundaryState = {
  error: Error | null
}

/** Next.js control-flow errors (`notFound()`, `redirect()`, …) carry a `NEXT_`-prefixed digest. */
const isNextControlFlowError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "digest" in error &&
  typeof error.digest === "string" &&
  error.digest.startsWith("NEXT_")

class QueryErrorBoundary extends Component<
  QueryErrorBoundaryProps,
  QueryErrorBoundaryState
> {
  constructor(props: QueryErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): QueryErrorBoundaryState {
    // Let Next.js internal errors (notFound, redirect, …) reach the framework's own boundary.
    if (isNextControlFlowError(error)) {
      throw error
    }
    return { error }
  }

  override componentDidCatch(error: Error) {
    console.error("QueryErrorBoundary:", error)
  }

  handleRetry = () => {
    this.props.onQueryReset()
    this.setState({ error: null })
  }

  override render() {
    if (this.state.error) {
      return this.props.errorFallback({
        error: this.state.error,
        onRetry: this.handleRetry,
      })
    }
    return this.props.children
  }
}

/** Dev/test only: force a boundary's loading or error UI (e.g. for screenshots). Ignored in production. */
export type QuerySuspenseDebugState = "loading" | "error"

/** Exported so callers can type wrapper components that forward `fallback` / `errorFallback`. */
export type QuerySuspenseProps = {
  children: ReactNode
  /** Suspense fallback: usually a skeleton of the same layout. */
  fallback: ReactNode
  /** Rendered when a query below throws; `onRetry` resets the failed queries and re-renders. */
  errorFallback: (props: QuerySuspenseErrorFallbackProps) => ReactNode
  /**
   * Development / test only: render `fallback` or `errorFallback` without running queries.
   * No effect when `NODE_ENV` is `"production"`.
   */
  debugState?: QuerySuspenseDebugState
}

/**
 * TanStack's recommended suspense stack (`QueryErrorResetBoundary` → error boundary →
 * `Suspense`, see https://tanstack.com/query/v5/docs/framework/react/guides/suspense), plus a
 * hydration gate: `fallback` is all it renders on the server and through hydration, unless a
 * `PrefetchedQueries` (e.g. from `QueryHydrationBoundary`) above it was handed dehydrated queries.
 */
export function QuerySuspense({
  children,
  errorFallback,
  fallback,
  debugState,
}: QuerySuspenseProps) {
  const isHydrated = useIsHydrated()
  /* The one way out of the gate below, and it cannot be claimed: it is true only inside a
     `PrefetchedQueries` that was handed a filled dehydrated payload. */
  const hasPrefetchedQueries = useHasPrefetchedQueries()

  if (debugStateEnabled && debugState === "loading") {
    return <>{fallback}</>
  }
  if (debugStateEnabled && debugState === "error") {
    return <>{errorFallback({ error: debugError, onRetry: noop })}</>
  }

  /* A suspense query whose `queryFn` calls a Server Function cannot run in the initial SSR render:
     React wires `callServer` to a thrower there ("Server Functions cannot be called during initial
     render"), so the query rejects and this boundary would render `errorFallback` into the HTML,
     while the client, whose cache nothing hydrates, suspends instead and throws that markup away.
     The mismatch re-renders the whole subtree on the client. Rendering `fallback` alone until
     hydration keeps both passes identical and skips a server fetch whose result would be
     discarded anyway. Prefetching into a `PrefetchedQueries` is what buys real server HTML back.

     It replaces the tree rather than swapping the boundary's child, because a suspending *update*
     leaves the previous children mounted-but-hidden beside the fallback: two copies of the same
     skeleton in the DOM. */
  if (!(isHydrated || hasPrefetchedQueries)) {
    return <>{fallback}</>
  }

  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <QueryErrorBoundary errorFallback={errorFallback} onQueryReset={reset}>
          <Suspense fallback={fallback}>{children}</Suspense>
        </QueryErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
