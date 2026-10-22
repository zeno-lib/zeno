import type { QueryClient } from "@tanstack/react-query"

/**
 * The server functions a query route serves, keyed by the name the browser
 * calls them by. Each takes one argument and resolves to the query's data.
 */
// biome-ignore lint/suspicious/noExplicitAny: `never` would reject a zero-argument function, `any` accepts every one-argument shape
export type QueryMap = Record<string, (input: any) => Promise<unknown>>

/** The body type both ways; the route refuses any other. */
export const QUERY_CONTENT_TYPE = "application/json"

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
