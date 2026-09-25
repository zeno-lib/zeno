import { DehydratedState } from "@tanstack/react-query";
import { ReactNode } from "react";
//#region src/prefetched-queries.d.ts
/** Whether the nearest `PrefetchedQueries` above was handed at least one dehydrated query. */
declare function useHasPrefetchedQueries(): boolean;
type PrefetchedQueriesProps = {
  children: ReactNode;
  state: DehydratedState;
};
/**
 * TanStack's `HydrationBoundary` plus the flag above. It hydrates `state` into the cache **during
 * render** (on the server pass as well as in the browser), so a `useSuspenseQuery` below it
 * resolves synchronously in both and the two passes produce the same markup.
 */
declare function PrefetchedQueries({ children, state }: PrefetchedQueriesProps): import("react/jsx-runtime").JSX.Element;
//#endregion
export { PrefetchedQueries, PrefetchedQueriesProps, useHasPrefetchedQueries };