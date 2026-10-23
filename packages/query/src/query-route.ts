import { parse, stringify } from "devalue"
import { findQuery, QUERY_CONTENT_TYPE, type QueryMap } from "./query-map"

export type { QueryMap } from "./query-map"

/** The largest body the route parses, the default Server Functions accept. */
const MAX_BODY_BYTES = 1024 * 1024

const TRAILING_SLASH = /\/$/

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
      const query = findQuery(queries, queryName(request))
      if (!query) {
        return new Response(null, { status: 404 })
      }
      // A cross-site page can only send a simple content type without a
      // preflight, so requiring JSON keeps other origins out.
      if (
        !request.headers.get("content-type")?.startsWith(QUERY_CONTENT_TYPE)
      ) {
        return new Response(null, { status: 415 })
      }
      if (Number(request.headers.get("content-length")) > MAX_BODY_BYTES) {
        return new Response(null, { status: 413 })
      }

      const body = await request.text()
      if (body.length > MAX_BODY_BYTES) {
        return new Response(null, { status: 413 })
      }
      let input: unknown
      try {
        input = parse(body)
      } catch {
        return new Response(null, { status: 400 })
      }

      const data = await query(input)

      return new Response(stringify(data), {
        headers: {
          "cache-control": "private, no-store",
          "content-type": QUERY_CONTENT_TYPE,
        },
      })
    },
  }
}

/** The path's last segment, or `""` when it is not a valid escape. */
function queryName(request: Request): string {
  const segment = new URL(request.url).pathname
    .replace(TRAILING_SLASH, "")
    .split("/")
    .at(-1)
  try {
    return decodeURIComponent(segment ?? "")
  } catch {
    return ""
  }
}
