import type { QueryClient } from "@tanstack/react-query"
import { parse, stringify } from "devalue"
import {
  findQuery,
  getBoundQueries,
  QUERY_CONTENT_TYPE,
  type QueryMap,
} from "./query-map"

export type { QueryMap } from "./query-map"

/** The part of TanStack's `QueryFunctionContext` a call reads. */
export type QueryCallContext = {
  /** Finds the queries a `QueryHydrationBoundary` bound for its server pass. */
  client?: QueryClient
  /** Abandons the request when TanStack cancels the query. */
  signal?: AbortSignal
}

/** What `name` takes: its one argument, or nothing. */
export type QueryInput<
  TQueries extends QueryMap,
  TName extends keyof TQueries,
> = Parameters<TQueries[TName]>[0]

/** What `name` resolves to. */
export type QueryData<
  TQueries extends QueryMap,
  TName extends keyof TQueries,
> = Awaited<ReturnType<TQueries[TName]>>

/** A query the route answered with an error status. */
export class QueryRequestError extends Error {
  readonly query: string
  readonly status: number

  constructor(query: string, status: number) {
    super(`Query ${query} failed with status ${status}`)
    this.name = "QueryRequestError"
    this.query = query
    this.status = status
  }
}

export type QueryCaller<TQueries extends QueryMap> = <
  TName extends keyof TQueries & string,
>(
  name: TName,
  input: QueryInput<TQueries, TName>,
  context?: QueryCallContext
) => Promise<QueryData<TQueries, TName>>

/**
 * Builds the browser side of `createQueryRoute`: `callQuery(name, input,
 * context)` posts to `${path}/${name}` and resolves to the query's data. Type
 * it with the map the route serves, imported as a type only, so no server code
 * reaches the bundle:
 *
 * ```ts
 * import type { queries } from "./queries"
 *
 * export const callQuery = createQueryCaller<typeof queries>({
 *   path: "/api/queries",
 * })
 *
 * queryFn: (context) => callQuery("selectPosts", { authorId }, context)
 * ```
 *
 * Unlike a Server Function, each call is its own request, so a screen's
 * queries run in parallel, and TanStack's `signal` cancels them. During a
 * `QueryHydrationBoundary` prefetch, the call runs the bound server function
 * in-process instead.
 */
export function createQueryCaller<TQueries extends QueryMap>({
  path,
}: {
  /** Where the route is mounted, without the trailing name segment. */
  path: string
}): QueryCaller<TQueries> {
  return async (name, input, context = {}) => {
    const bound = context.client && getBoundQueries(context.client)
    if (bound) {
      const query = findQuery(bound, name)
      if (!query) {
        throw new Error(
          `callQuery: "${name}" is not in the queries bound to this QueryHydrationBoundary`
        )
      }
      return (await query(input)) as QueryData<TQueries, typeof name>
    }
    if (typeof window === "undefined") {
      throw new Error(
        `callQuery: "${name}" ran on the server outside a QueryHydrationBoundary that binds its queries`
      )
    }

    const response = await fetch(`${path}/${encodeURIComponent(name)}`, {
      body: stringify(input),
      headers: { "content-type": QUERY_CONTENT_TYPE },
      method: "POST",
      // A redirect means the session is gone (a middleware sending the request
      // to sign in). Reload, so it redirects the page instead of the fetch.
      redirect: "manual",
      signal: context.signal,
    })

    if (response.type === "opaqueredirect") {
      reloadOnce()
      throw new QueryRequestError(name, 401)
    }
    // A page answering 200 in the route's place (a rewrite to sign in, a
    // host's password wall) is not data.
    if (
      !(
        response.ok &&
        response.headers.get("content-type")?.startsWith(QUERY_CONTENT_TYPE)
      )
    ) {
      throw new QueryRequestError(name, response.status)
    }

    return parse(await response.text())
  }
}

const RELOADED_AT_KEY = "zeno-query:reloaded-at"

/**
 * Reloads the page, unless a redirect already did within the last minute: a
 * redirect the reload does not clear (a trailing-slash rule, a middleware that
 * redirects only API paths) would otherwise reload forever.
 */
function reloadOnce() {
  const reloadedAt = Number(sessionStorage.getItem(RELOADED_AT_KEY))
  if (Date.now() - reloadedAt < 60_000) {
    return
  }
  sessionStorage.setItem(RELOADED_AT_KEY, String(Date.now()))
  window.location.reload()
}
