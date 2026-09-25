import {
  dehydrate,
  QueryClient,
  QueryClientProvider,
  useSuspenseQuery,
} from "@tanstack/react-query"
import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { Component, type ReactNode } from "react"
import { renderToString } from "react-dom/server"
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest"
import { PrefetchedQueries } from "./prefetched-queries"
import { QueryHydrationBoundary } from "./query-hydration-boundary"
import {
  QuerySuspense,
  type QuerySuspenseErrorFallbackProps,
} from "./query-suspense"
import { QuerySuspenseLoading } from "./query-suspense-loading"

const KEY = ["greeting"]
const ANY_FAILURE = /failed:/
const DEBUG_FAILURE = /failed: QuerySuspense: debugState="error"/

// @testing-library auto-cleanup only runs with `globals: true`; our vitest config keeps it off.
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

beforeEach(() => {
  // The error boundary logs what it catches; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => undefined)
})

const createClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false } } })

function Greeting({ queryFn }: { queryFn: () => Promise<string> }) {
  const { data } = useSuspenseQuery({ queryFn, queryKey: KEY })
  return <p>{data}</p>
}

const errorFallback = ({ error, onRetry }: QuerySuspenseErrorFallbackProps) => (
  <div>
    <p>failed: {error.message}</p>
    <button onClick={onRetry} type="button">
      retry
    </button>
  </div>
)

function Subject({
  queryFn,
  debugState,
}: {
  queryFn: () => Promise<string>
  debugState?: "loading" | "error"
}) {
  return (
    <QuerySuspense
      debugState={debugState}
      errorFallback={errorFallback}
      fallback={<p>loading</p>}
    >
      <Greeting queryFn={queryFn} />
    </QuerySuspense>
  )
}

const withClient = (client: QueryClient, children: ReactNode) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

/** Stands in for the framework's own boundary (e.g. Next.js's not-found boundary). */
// biome-ignore lint/style/useReactFunctionComponents: an error boundary can only be a class
class Outer extends Component<
  { children: ReactNode },
  { caught: string | null }
> {
  override state = { caught: null }
  static getDerivedStateFromError(error: Error) {
    return { caught: error.message }
  }
  override render() {
    return this.state.caught ? (
      <p>outer caught {this.state.caught}</p>
    ) : (
      this.props.children
    )
  }
}

async function prefetchedState() {
  const server = createClient()
  await server.prefetchQuery({ queryFn: () => "from server", queryKey: KEY })
  return dehydrate(server)
}

describe("QuerySuspense on the server", () => {
  test("renders only the fallback and never runs the query", () => {
    const queryFn = vi.fn(() => Promise.resolve("hello"))
    const html = renderToString(
      withClient(createClient(), <Subject queryFn={queryFn} />)
    )
    expect(html).toContain("loading")
    expect(html).not.toContain("hello")
    expect(queryFn).not.toHaveBeenCalled()
  })

  test("renders the content inside a filled PrefetchedQueries", async () => {
    const queryFn = vi.fn(() => Promise.resolve("from client"))
    const state = await prefetchedState()
    const html = renderToString(
      withClient(
        createClient(),
        <PrefetchedQueries state={state}>
          <Subject queryFn={queryFn} />
        </PrefetchedQueries>
      )
    )
    expect(html).toContain("from server")
    expect(html).not.toContain("loading")
    expect(queryFn).not.toHaveBeenCalled()
  })

  test("keeps the gate closed when the dehydrated payload is empty", () => {
    const queryFn = vi.fn(() => Promise.resolve("hello"))
    const html = renderToString(
      withClient(
        createClient(),
        <PrefetchedQueries state={dehydrate(createClient())}>
          <Subject queryFn={queryFn} />
        </PrefetchedQueries>
      )
    )
    expect(html).toContain("loading")
    expect(queryFn).not.toHaveBeenCalled()
  })
})

describe("QueryHydrationBoundary", () => {
  test("runs prefetch on the client it builds and server-renders the result", async () => {
    const serverClient = createClient()
    const createQueryClient = vi.fn(() => serverClient)
    const prefetch = vi.fn((queryClient: QueryClient) =>
      queryClient.prefetchQuery({
        queryFn: () => "prefetched",
        queryKey: KEY,
      })
    )

    const element = await QueryHydrationBoundary({
      children: <Subject queryFn={() => Promise.resolve("unused")} />,
      createQueryClient,
      prefetch,
    })

    expect(createQueryClient).toHaveBeenCalledOnce()
    expect(prefetch).toHaveBeenCalledWith(serverClient)
    expect(renderToString(withClient(createClient(), element))).toContain(
      "prefetched"
    )
  })

  test("defaults to a fresh QueryClient", async () => {
    const prefetch = vi.fn((queryClient: QueryClient) =>
      Promise.resolve(queryClient)
    )
    await QueryHydrationBoundary({ children: null, prefetch })
    expect(prefetch.mock.calls[0]?.[0]).toBeInstanceOf(QueryClient)
  })
})

describe("QuerySuspense in the browser", () => {
  test("suspends, then renders the data", async () => {
    render(
      withClient(
        createClient(),
        <Subject queryFn={() => Promise.resolve("hello")} />
      )
    )
    expect(screen.getByText("loading")).toBeDefined()
    expect(await screen.findByText("hello")).toBeDefined()
  })

  test("renders errorFallback, and onRetry refetches", async () => {
    const queryFn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recovered")

    render(withClient(createClient(), <Subject queryFn={queryFn} />))
    expect(await screen.findByText("failed: boom")).toBeDefined()

    await userEvent.click(screen.getByRole("button", { name: "retry" }))
    expect(await screen.findByText("recovered")).toBeDefined()
    expect(queryFn).toHaveBeenCalledTimes(2)
  })

  test("lets Next.js control-flow errors through to an outer boundary", async () => {
    const notFound = Object.assign(new Error("not found"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    })

    render(
      withClient(
        createClient(),
        <Outer>
          <Subject queryFn={() => Promise.reject(notFound)} />
        </Outer>
      )
    )
    expect(await screen.findByText("outer caught not found")).toBeDefined()
    expect(screen.queryByText(ANY_FAILURE)).toBeNull()
  })

  test("debugState forces the loading or error UI without running the query", () => {
    const queryFn = vi.fn(() => Promise.resolve("hello"))
    const { rerender } = render(
      withClient(
        createClient(),
        <Subject debugState="loading" queryFn={queryFn} />
      )
    )
    expect(screen.getByText("loading")).toBeDefined()

    rerender(
      withClient(
        createClient(),
        <Subject debugState="error" queryFn={queryFn} />
      )
    )
    expect(screen.getByText(DEBUG_FAILURE)).toBeDefined()
    expect(queryFn).not.toHaveBeenCalled()
  })
})

describe("QuerySuspenseLoading", () => {
  test("defaults aria-busy and aria-live, and lets them be overridden", () => {
    render(
      <>
        <QuerySuspenseLoading data-testid="default" />
        <QuerySuspenseLoading
          aria-busy={false}
          aria-live="off"
          className="grid"
          data-testid="custom"
        />
      </>
    )
    const byDefault = screen.getByTestId("default")
    expect(byDefault.getAttribute("aria-busy")).toBe("true")
    expect(byDefault.getAttribute("aria-live")).toBe("polite")

    const custom = screen.getByTestId("custom")
    expect(custom.getAttribute("aria-busy")).toBe("false")
    expect(custom.getAttribute("aria-live")).toBe("off")
    expect(custom.className).toBe("grid")
  })
})
