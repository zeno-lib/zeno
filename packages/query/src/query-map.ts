import type { QueryClient } from "@tanstack/react-query"

/**
 * The server functions a query route serves, keyed by the name the browser
 * calls them by. Each takes one argument and resolves to the query's data.
 */
// biome-ignore lint/suspicious/noExplicitAny: `never` would reject a zero-argument function, `any` accepts every one-argument shape
export type QueryMap = Record<string, (input: any) => Promise<unknown>>

/**
 * The function `queries` serves as `name`. `Object.hasOwn`, so `constructor` or
 * `__proto__` is not a query, and the type check, so a module namespace's
 * `__esModule` flag is not one either.
 */
export function findQuery(
  queries: QueryMap,
  name: string
): QueryMap[string] | undefined {
  const query = Object.hasOwn(queries, name) ? queries[name] : undefined
  return typeof query === "function" ? query : undefined
}

/** The body type both ways; the route refuses any other. */
export const QUERY_CONTENT_TYPE = "application/json"

/**
 * Set on the route's own `404` for a name it does not serve, so the caller
 * tells it from a host's `404` page or a wrong `path`.
 */
export const QUERY_MISSING_HEADER = "x-query-missing"

/**
 * The queries bound to a server `QueryClient`. A query function that runs
 * against that client calls the server function in-process instead of going
 * through the route, which a server render has no URL for.
 */
const boundQueries = new WeakMap<QueryClient, QueryMap>()

export function bindQueries(client: QueryClient, queries: QueryMap): void {
  boundQueries.set(client, queries)
}

export function getBoundQueries(client: QueryClient): QueryMap | undefined {
  return boundQueries.get(client)
}
