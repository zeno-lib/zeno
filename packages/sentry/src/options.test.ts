import { afterEach, describe, expect, it, vi } from "vitest"
import { sharedOptions } from "./options"

// The SDK drops an event when a pattern matches its exception's value.
const isIgnored = (value: string) =>
  sharedOptions().ignoreErrors.some((pattern) => pattern.test(value))

describe("ignoreErrors", () => {
  it.each([
    "Failed to fetch",
    // Sentry's fetch instrumentation names the host of an absolute URL.
    "Failed to fetch (abcd.supabase.co)",
    "Load failed",
    "NetworkError when attempting to fetch resource.",
    "The network connection was lost.",
    "TypeError: Failed to fetch",
  ])("drops a fetch that got no answer: %s", (value) => {
    expect(isIgnored(value)).toBe(true)
  })

  it.each([
    "Failed to fetch the project's documents",
    "Query selectProjectQuery failed with status 500",
    "x.map is not a function",
  ])("reports anything else: %s", (value) => {
    expect(isIgnored(value)).toBe(false)
  })
})

describe("enabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  // `next start` runs as `production` in CI and on previews too, so only the
  // app's own environment variable may turn reporting on.
  it("stays off unless the environment is production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "preview")

    expect(sharedOptions().enabled).toBe(false)
  })

  it("turns on in production", () => {
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "production")

    expect(sharedOptions().enabled).toBe(true)
  })
})
