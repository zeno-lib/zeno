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

const SECOND = 1000
const MINUTE = 60 * SECOND

/** Fast-moving data that keeps updating even while the tab is hidden: 15 s, refetched in the background. */
export const liveBackgroundQueryDefaults = {
  refetchInterval: 15 * SECOND,
  refetchIntervalInBackground: true,
  staleTime: 15 * SECOND,
} as const

/** Fast-moving data refreshed while it is on screen: 30 s. */
export const liveQueryDefaults = {
  refetchInterval: 30 * SECOND,
  staleTime: 30 * SECOND,
} as const

/** Data that can be slightly stale: 1 min. */
export const shortLivedQueryDefaults = {
  staleTime: MINUTE,
} as const

/** Slower-changing detail data: 2 min. */
export const longLivedQueryDefaults = {
  staleTime: 2 * MINUTE,
} as const

/** Reference data worth keeping longer: 5 min stale, 30 min in the cache (the one preset that raises `gcTime`). */
export const cachedQueryDefaults = {
  gcTime: 30 * MINUTE,
  staleTime: 5 * MINUTE,
} as const

/** Effectively immutable data: never stale. */
export const staticQueryDefaults = {
  staleTime: Number.POSITIVE_INFINITY,
} as const
