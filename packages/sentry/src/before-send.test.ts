import { describe, expect, it } from "vitest"
import { groupServerReportedErrors } from "./before-send"

function beforeSend(originalException: unknown, transaction?: string) {
  return groupServerReportedErrors(
    { tags: { existing: "kept" }, transaction, type: undefined },
    { originalException }
  )
}

describe("groupServerReportedErrors", () => {
  const serverError = Object.assign(new Error("redacted"), {
    digest: "1234567",
  })

  it("groups a server-reported error by page and tags its digest", () => {
    const event = beforeSend(serverError, "/projects/[projectId]")

    expect(event.fingerprint).toEqual([
      "server-function-error",
      "/projects/[projectId]",
    ])
    expect(event.tags).toEqual({ digest: "1234567", existing: "kept" })
  })

  it("still sends it, so Replay keeps the buffered recording", () => {
    expect(beforeSend(serverError)).not.toBeNull()
  })

  it("keeps a fingerprint the app set", () => {
    const event = groupServerReportedErrors(
      { fingerprint: ["checkout-failure"], type: undefined },
      { originalException: serverError }
    )

    expect(event.fingerprint).toEqual(["checkout-failure"])
    expect(event.tags).toEqual({ digest: "1234567" })
  })

  // `notFound()`, `forbidden()` and `unauthorized()` have no server event to
  // join, so they must not land in the page's server error issue.
  it("leaves a Next.js control-flow error to default grouping", () => {
    const forbidden = Object.assign(new Error("redacted"), {
      digest: "NEXT_HTTP_ERROR_FALLBACK;403",
    })
    const event = beforeSend(forbidden, "/projects/[projectId]")

    expect(event.fingerprint).toBeUndefined()
    expect(event.tags).toEqual({ existing: "kept" })
  })

  it("leaves a browser error to default grouping", () => {
    const event = beforeSend(new Error("browser"))

    expect(event.fingerprint).toBeUndefined()
    expect(event.tags).toEqual({ existing: "kept" })
  })

  it("leaves a captured message alone", () => {
    expect(beforeSend("A captured message").fingerprint).toBeUndefined()
  })
})
