import { parse, stringify } from "devalue"
import { QUERY_CONTENT_TYPE, type QueryMap } from "./query-map"

export type { QueryMap } from "./query-map"

/**
 * Builds the `POST` handler of a route that serves `queries` to the browser,
 * one request per call, so the reads of a screen run in parallel. Mount it on a
 * dynamic segment whose last part is the query's name:
 *
 * ```ts
 * // app/api/queries/[query]/route.ts
 * export const { POST } = createQueryRoute(queries)
 * ```
 *
 * The body and the result travel through `devalue`, so a `Date`, a `Map`, a
 * `bigint` or an `undefined` arrives as it was sent. An error the query throws
 * is left to the framework, which answers 500 and reports it. Every entry of
 * `queries` is a public endpoint: authorize inside it, as you would in a
 * server action.
 */
export function createQueryRoute(queries: QueryMap): {
  POST: (request: Request) => Promise<Response>
} {
  return {
    POST: async (request) => {
      const name = decodeURIComponent(
        new URL(request.url).pathname.split("/").at(-1) ?? ""
      )
      // `Object.hasOwn`, so `constructor` or `__proto__` is not a query.
      if (!Object.hasOwn(queries, name)) {
        return new Response(null, { status: 404 })
      }
      // A cross-site page can only send a simple content type without a
      // preflight, so requiring JSON keeps other origins out.
      if (
        !request.headers.get("content-type")?.startsWith(QUERY_CONTENT_TYPE)
      ) {
        return new Response(null, { status: 415 })
      }

      const query = queries[name] as QueryMap[string]
      const data = await query(parse(await request.text()))

      return new Response(stringify(data), {
        headers: {
          "cache-control": "private, no-store",
          "content-type": QUERY_CONTENT_TYPE,
        },
      })
    },
  }
}
