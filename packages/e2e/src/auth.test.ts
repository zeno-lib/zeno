import type { APIRequestContext, Page } from "@playwright/test"
import { describe, expect, it, vi } from "vitest"
import {
  type ApiSession,
  sessionCookieValues,
  signInViaApi,
  supabaseStorageKey,
} from "./auth"

// Fakes the Playwright boundary (page, context, request) with only the calls
// the helper makes; a real browser run is the e2e suite's job.
const session: ApiSession = {
  access_token: "at",
  expires_at: 1,
  expires_in: 3600,
  refresh_token: "rt",
  token_type: "bearer",
  user: { email: "é@example.test", id: "u" },
}

function createFakes(body: unknown, status = 200) {
  const calls: string[] = []
  const context = {
    addCookies: vi.fn(() => {
      calls.push("addCookies")
      return Promise.resolve()
    }),
    clearCookies: vi.fn(() => {
      calls.push("clearCookies")
      return Promise.resolve()
    }),
  }
  const evaluate = vi.fn((_fn: unknown, arg: { event: string }) => {
    calls.push(`broadcast:${arg.event}`)
    return Promise.resolve()
  })
  const post = vi.fn(() => {
    calls.push("post")
    return Promise.resolve({
      json: async () => body,
      ok: () => status >= 200 && status < 300,
      status: () => status,
      text: async () => JSON.stringify(body),
    })
  })
  const request = { post } as unknown as APIRequestContext
  const page = {
    context: () => context,
    evaluate,
    request,
  } as unknown as Page
  return { calls, context, evaluate, page, post, request }
}

const BASE64_PREFIX = /^base64-/
const REFUSED = /failed with 404: .*Not found/
const NO_STORAGE_KEY = /no storageKey/

const decode = (value: string) =>
  JSON.parse(
    Buffer.from(value.replace(BASE64_PREFIX, ""), "base64url").toString("utf8")
  ) as unknown

describe("supabaseStorageKey", () => {
  it.each([
    ["http://127.0.0.1:54321", "sb-127-auth-token"],
    ["http://localhost:54321", "sb-localhost-auth-token"],
    ["https://abcd.supabase.co", "sb-abcd-auth-token"],
  ])("%s -> %s", (url, key) => {
    expect(supabaseStorageKey(url)).toBe(key)
  })
})

describe("sessionCookieValues", () => {
  it("writes one base64url cookie that round-trips, UTF-8 included", () => {
    const cookies = sessionCookieValues("sb-127-auth-token", session)

    expect(cookies).toHaveLength(1)
    expect(cookies[0]?.name).toBe("sb-127-auth-token")
    expect(cookies[0]?.value.startsWith("base64-")).toBe(true)
    expect(decode(cookies[0]?.value ?? "")).toEqual(session)
  })

  it("chunks a large session the way @supabase/ssr names chunks", () => {
    const large = { ...session, user: { blob: "x".repeat(5000) } }
    const cookies = sessionCookieValues("sb-127-auth-token", large)

    expect(cookies.map((cookie) => cookie.name)).toEqual([
      "sb-127-auth-token.0",
      "sb-127-auth-token.1",
      "sb-127-auth-token.2",
    ])
    expect(cookies.every((cookie) => cookie.value.length <= 3180)).toBe(true)
    expect(decode(cookies.map((cookie) => cookie.value).join(""))).toEqual(
      large
    )
  })
})

describe("signInViaApi", () => {
  const url = "http://localhost:3100/api/test/sign-in"

  it("posts credentials, resets the context, installs the cookie and broadcasts", async () => {
    const fakes = createFakes({ session, storageKey: "sb-127-auth-token" })

    await expect(
      signInViaApi({ email: "a@b.test", page: fakes.page, password: "pw", url })
    ).resolves.toEqual(session)

    expect(fakes.post).toHaveBeenCalledWith(url, {
      data: { email: "a@b.test", password: "pw" },
    })
    expect(fakes.calls).toEqual([
      "post",
      "clearCookies",
      "broadcast:SIGNED_OUT",
      "addCookies",
      "broadcast:SIGNED_IN",
    ])
    expect(fakes.context.addCookies).toHaveBeenCalledWith([
      expect.objectContaining({
        domain: "localhost",
        httpOnly: false,
        name: "sb-127-auth-token",
        path: "/",
        sameSite: "Lax",
        secure: false,
      }),
    ])
    expect(fakes.evaluate).toHaveBeenLastCalledWith(expect.any(Function), {
      channelName: "sb-127-auth-token",
      event: "SIGNED_IN",
      session,
    })
  })

  it("prefers an explicit request and storageKey", async () => {
    const fakes = createFakes({ session, storageKey: "sb-127-auth-token" })
    const other = createFakes({ session })

    await signInViaApi({
      email: "a@b.test",
      page: fakes.page,
      password: "pw",
      request: other.request,
      storageKey: "sb-custom-auth-token",
      url: "https://app.example.test/api/test/sign-in",
    })

    expect(fakes.post).not.toHaveBeenCalled()
    expect(other.post).toHaveBeenCalledOnce()
    expect(fakes.context.addCookies).toHaveBeenCalledWith([
      expect.objectContaining({
        domain: "app.example.test",
        name: "sb-custom-auth-token",
        secure: true,
      }),
    ])
  })

  it("throws with the status and body when the route refuses", async () => {
    const fakes = createFakes({ error: "Not found" }, 404)

    await expect(
      signInViaApi({ email: "a@b.test", page: fakes.page, password: "pw", url })
    ).rejects.toThrow(REFUSED)
    expect(fakes.context.addCookies).not.toHaveBeenCalled()
  })

  it("throws when no storage key is known", async () => {
    const fakes = createFakes({ session })

    await expect(
      signInViaApi({ email: "a@b.test", page: fakes.page, password: "pw", url })
    ).rejects.toThrow(NO_STORAGE_KEY)
  })
})
