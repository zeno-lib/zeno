import { getCurrentScope } from "@sentry/core"
import { captureRequestError } from "@sentry/nextjs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { onRequestError } from "./request-error"

// The real scope functions, which `@sentry/nextjs` re-exports from core.
vi.mock("@sentry/nextjs", async () => {
  const { getCurrentScope: coreGetCurrentScope, withScope } = await import(
    "@sentry/core"
  )
  return {
    captureRequestError: vi.fn(),
    getCurrentScope: coreGetCurrentScope,
    withScope,
  }
})

const mockedCaptureRequestError = vi.mocked(captureRequestError)

type Args = Parameters<typeof onRequestError>
const request = { headers: {}, method: "POST", path: "/projects/1" } as Args[1]
const errorContext = {
  routePath: "/projects/[projectId]",
  routerKind: "App Router",
  routeType: "action",
} as Args[2]

function tagsSeenByCapture() {
  let tags: Record<string, unknown> = {}
  mockedCaptureRequestError.mockImplementation(() => {
    ;({ tags } = getCurrentScope().getScopeData())
  })
  return () => tags
}

describe("onRequestError", () => {
  beforeEach(() => {
    mockedCaptureRequestError.mockReset()
  })

  it("tags the digest the browser copy carries", () => {
    const tags = tagsSeenByCapture()
    const error = Object.assign(new Error("boom"), { digest: "1234567" })

    onRequestError(error, request, errorContext)

    expect(mockedCaptureRequestError).toHaveBeenCalledWith(
      error,
      request,
      errorContext
    )
    expect(tags()).toEqual(expect.objectContaining({ digest: "1234567" }))
  })

  it("does not leak the tag to later events", () => {
    onRequestError(
      Object.assign(new Error("boom"), { digest: "1234567" }),
      request,
      errorContext
    )

    expect(getCurrentScope().getScopeData().tags).not.toHaveProperty("digest")
  })

  it("reports an error without a digest unchanged", () => {
    const tags = tagsSeenByCapture()

    onRequestError(new Error("boom"), request, errorContext)

    expect(mockedCaptureRequestError).toHaveBeenCalledOnce()
    expect(tags()).not.toHaveProperty("digest")
  })
})
