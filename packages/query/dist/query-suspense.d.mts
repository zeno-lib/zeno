import { ReactNode } from "react";
//#region src/query-suspense.d.ts
type QuerySuspenseErrorFallbackProps = {
  error: Error;
  onRetry: () => void;
};
/** Dev/test only: force a boundary's loading or error UI (e.g. for screenshots). Ignored in production. */
type QuerySuspenseDebugState = "loading" | "error";
/** Exported so callers can type wrapper components that forward `fallback` / `errorFallback`. */
type QuerySuspenseProps = {
  children: ReactNode;
  /** Suspense fallback: usually a skeleton of the same layout. */
  fallback: ReactNode;
  /** Rendered when a query below throws; `onRetry` resets the failed queries and re-renders. */
  errorFallback: (props: QuerySuspenseErrorFallbackProps) => ReactNode;
  /**
   * Development / test only: render `fallback` or `errorFallback` without running queries.
   * No effect when `NODE_ENV` is `"production"`.
   */
  debugState?: QuerySuspenseDebugState;
};
/**
 * TanStack's recommended suspense stack (`QueryErrorResetBoundary` → error boundary →
 * `Suspense`, see https://tanstack.com/query/v5/docs/framework/react/guides/suspense), plus a
 * hydration gate: `fallback` is all it renders on the server and through hydration, unless a
 * `PrefetchedQueries` (e.g. from `QueryHydrationBoundary`) above it was handed dehydrated queries.
 */
declare function QuerySuspense({ children, errorFallback, fallback, debugState }: QuerySuspenseProps): import("react/jsx-runtime").JSX.Element;
//#endregion
export { QuerySuspense, QuerySuspenseDebugState, QuerySuspenseErrorFallbackProps, QuerySuspenseProps };