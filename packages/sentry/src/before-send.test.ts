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

  it("falls back when the page is unknown", () => {
    expect(beforeSend(serverError).fingerprint).toEqual([
      "server-function-error",
      "unknown",
    ])
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
