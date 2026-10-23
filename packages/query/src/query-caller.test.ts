import { QueryClient } from "@tanstack/react-query"
import { afterEach, describe, expect, test, vi } from "vitest"
import { createQueryCaller, QueryRequestError } from "./query-caller"
import { QueryHydrationBoundary } from "./query-hydration-boundary"
import { createQueryRoute } from "./query-route"

const queries = {
  echo: (input: { at: Date; note?: string }) => Promise.resolve(input),
  fail: () => Promise.reject(new Error("boom")),
}

const route = createQueryRoute(queries)
const callQuery = createQueryCaller<typeof queries>({ path: "/api/queries" })

/** Sends every fetch to the route, as the browser's request would reach it. */
const fetchThroughRoute = vi.fn((url: string, init: RequestInit) =>
  route.POST(new Request(new URL(url, "http://localhost"), init))
)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  fetchThroughRoute.mockClear()
})

const post = (
  name: string,
  { body = "-1", contentType = "application/json" } = {}
) =>
  route.POST(
    new Request(`http://localhost/api/queries/${name}`, {
      body,
      headers: { "content-type": contentType },
      method: "POST",
    })
  )

describe("createQueryRoute", () => {
  test("answers 404 for a name that is not an own key of the map", async () => {
    expect((await post("missing")).status).toBe(404)
    expect((await post("constructor")).status).toBe(404)
    expect((await post("__proto__")).status).toBe(404)
    expect((await post("%E0")).status).toBe(404)
  })

  test("answers 404 for an own key that is not a function, as a namespace's __esModule", async () => {
    const namespace = Object.defineProperty({ ...queries }, "__esModule", {
      value: true,
    })
    const response = await createQueryRoute(namespace).POST(
      new Request("http://localhost/api/queries/__esModule", {
        body: "-1",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    )

    expect(response.status).toBe(404)
  })

  test("refuses a body that is not JSON, which a cross-site form could send", async () => {
    expect((await post("echo", { contentType: "text/plain" })).status).toBe(415)
  })

  test("answers 400 for a body devalue cannot parse", async () => {
    expect((await post("echo", { body: "{not devalue" })).status).toBe(400)
  })

  test("answers 413 for a body over the limit", async () => {
    const body = JSON.stringify("x".repeat(1024 * 1024))

    expect((await post("echo", { body })).status).toBe(413)
  })

  test("leaves a query's error to the framework", async () => {
    await expect(post("fail")).rejects.toThrow("boom")
  })
})

describe("createQueryCaller", () => {
  test("round-trips values JSON would lose", async () => {
    vi.stubGlobal("fetch", fetchThroughRoute)
    const at = new Date("2026-01-02T03:04:05Z")

    const data = await callQuery("echo", { at, note: undefined })

    expect(data.at).toBeInstanceOf(Date)
    expect(data.at.getTime()).toBe(at.getTime())
    expect(data).toHaveProperty("note", undefined)
  })

  test("throws QueryRequestError with the route's status", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(new Response(null, { status: 500 }))
    )

    const failure = callQuery("echo", { at: new Date() })

    await expect(failure).rejects.toBeInstanceOf(QueryRequestError)
    await expect(failure).rejects.toMatchObject({ query: "echo", status: 500 })
  })

  test("throws QueryRequestError for a 200 that is not the route's answer", async () => {
    vi.stubGlobal("fetch", () =>
      Promise.resolve(
        new Response("<html></html>", {
          headers: { "content-type": "text/html" },
        })
      )
    )

    await expect(callQuery("echo", { at: new Date() })).rejects.toBeInstanceOf(
      QueryRequestError
    )
  })

  test("reloads on a redirect only once a minute, so a redirect the reload keeps does not loop", async () => {
    const reload = vi.fn()
    vi.stubGlobal("location", { ...window.location, reload })
    vi.stubGlobal("fetch", () =>
      Promise.resolve(Response.redirect("http://localhost/sign-in"))
    )
    vi.spyOn(Response.prototype, "type", "get").mockReturnValue(
      "opaqueredirect"
    )
    sessionStorage.clear()

    await expect(callQuery("echo", { at: new Date() })).rejects.toThrow()
    await expect(callQuery("echo", { at: new Date() })).rejects.toThrow()

    expect(reload).toHaveBeenCalledOnce()
  })

  test("calls the bound function in-process during a QueryHydrationBoundary prefetch", async () => {
    vi.stubGlobal("fetch", fetchThroughRoute)
    const at = new Date()
    let prefetched: unknown

    await QueryHydrationBoundary({
      children: null,
      prefetch: async (queryClient) => {
        prefetched = await queryClient.fetchQuery({
          queryFn: (context) => callQuery("echo", { at }, context),
          queryKey: ["echo"],
        })
      },
      queries,
    })

    expect(prefetched).toEqual({ at })
    expect(fetchThroughRoute).not.toHaveBeenCalled()
  })

  test("fetches through the route for a client no boundary bound", async () => {
    vi.stubGlobal("fetch", fetchThroughRoute)

    await new QueryClient().fetchQuery({
      queryFn: (context) => callQuery("echo", { at: new Date() }, context),
      queryKey: ["echo"],
    })

    expect(fetchThroughRoute).toHaveBeenCalledOnce()
  })
})
