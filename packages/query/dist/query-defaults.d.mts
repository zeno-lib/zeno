//#region src/query-defaults.d.ts
/**
 * Timing presets to spread as the first property of a `queryOptions(…)` call, so freshness stays
 * consistent across a codebase instead of every query inventing its own `staleTime`.
 *
 * ```ts
 * queryOptions({ ...cachedQueryDefaults, queryKey: ["countries"], queryFn: fetchCountries })
 * ```
 *
 * Every duration is in milliseconds.
 */
/** Fast-moving data that keeps updating even while the tab is hidden: 15 s, refetched in the background. */
declare const liveBackgroundQueryDefaults: {
  readonly refetchInterval: number;
  readonly refetchIntervalInBackground: true;
  readonly staleTime: number;
};
/** Fast-moving data refreshed while it is on screen: 30 s. */
declare const liveQueryDefaults: {
  readonly refetchInterval: number;
  readonly staleTime: number;
};
/** Data that can be slightly stale: 1 min. */
declare const shortLivedQueryDefaults: {
  readonly staleTime: number;
};
/** Slower-changing detail data: 2 min. */
declare const longLivedQueryDefaults: {
  readonly staleTime: number;
};
/** Reference data worth keeping longer: 5 min stale, 30 min in the cache (the one preset that raises `gcTime`). */
declare const cachedQueryDefaults: {
  readonly gcTime: number;
  readonly staleTime: number;
};
/** Effectively immutable data: never stale. */
declare const staticQueryDefaults: {
  readonly staleTime: number;
};
//#endregion
export { cachedQueryDefaults, liveBackgroundQueryDefaults, liveQueryDefaults, longLivedQueryDefaults, shortLivedQueryDefaults, staticQueryDefaults };