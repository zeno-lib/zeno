import { describe, expect, it } from "vitest"
import { safeNextPath } from "../src/confirm/safe-next-path"

const origin = "https://app.example.com"

describe("safeNextPath", () => {
  it("keeps a path on the app, with its query", () => {
    expect(safeNextPath("/oauth/consent?authorization_id=a1", origin)).toBe(
      "/oauth/consent?authorization_id=a1"
    )
  })

  it("turns a same-origin URL into its path", () => {
    expect(
      safeNextPath(
        "https://app.example.com/oauth/consent?authorization_id=a1",
        origin
      )
    ).toBe("/oauth/consent?authorization_id=a1")
  })

  it("accepts a URL on any of the app's origins", () => {
    expect(
      safeNextPath("https://app.example.com/oauth/consent", [
        "http://internal:3000",
        origin,
      ])
    ).toBe("/oauth/consent")
  })

  it.each([
    "https://evil.example.com/",
    "//evil.example.com/",
    "/\\evil.example.com/",
    "/.//evil.example.com/",
    "/..//evil.example.com/",
    "/./\\evil.example.com/",
    "https://app.example.com//evil.example.com/",
    "javascript:alert(1)",
    "",
    null,
  ])("refuses %s", (value) => {
    expect(safeNextPath(value, origin)).toBeNull()
  })
})
