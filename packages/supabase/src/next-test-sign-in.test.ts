import { beforeEach, describe, expect, it, vi } from "vitest"
import { createTestSignInRoute } from "./next-test-sign-in"

// Fakes the one dependency boundary: the cookie-backed server client, which
// needs a Next request scope (`cookies()`) that a unit test does not have.
const signInWithPassword = vi.fn()
const createClient = vi.fn(async (_url?: string, _key?: string) => ({
  auth: { signInWithPassword },
}))
vi.mock("./next-server", () => ({
  createClient: (url?: string, key?: string) => createClient(url, key),
}))

const post = (body: unknown) =>
  new Request("http://localhost:3000/api/test/sign-in", {
    body: typeof body === "string" ? body : JSON.stringify(body),
    method: "POST",
  })

const credentials = { email: "a@example.test", password: "pw" }
const session = { access_token: "at", refresh_token: "rt" }

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321")
  signInWithPassword.mockResolvedValue({ data: { session }, error: null })
})

describe("createTestSignInRoute", () => {
  it("answers 404 without touching Supabase when the gate is closed", async () => {
    const isEnabled = vi.fn(() => false)
    const response = await createTestSignInRoute({ isEnabled })(
      post(credentials)
    )

    expect(response.status).toBe(404)
    expect(isEnabled).toHaveBeenCalledOnce()
    expect(createClient).not.toHaveBeenCalled()
  })

  it("evaluates the gate per request, not at creation", async () => {
    let enabled = false
    const route = createTestSignInRoute({ isEnabled: () => enabled })

    expect((await route(post(credentials))).status).toBe(404)
    enabled = true
    expect((await route(post(credentials))).status).toBe(200)
  })

  it.each([
    ["missing password", { email: "a@example.test" }],
    ["non-string email", { email: 1, password: "pw" }],
    ["invalid JSON", "{"],
    ["a JSON array", "[]"],
  ])("answers 400 for %s", async (_name, body) => {
    const response = await createTestSignInRoute({ isEnabled: () => true })(
      post(body)
    )
    expect(response.status).toBe(400)
    expect(signInWithPassword).not.toHaveBeenCalled()
  })

  it("returns the session and the derived storage key", async () => {
    const response = await createTestSignInRoute({ isEnabled: () => true })(
      post(credentials)
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
    expect(await response.json()).toEqual({
      session,
      storageKey: "sb-127-auth-token",
    })
    expect(signInWithPassword).toHaveBeenCalledWith(credentials)
  })

  it("passes explicit url and key through and derives the key from them", async () => {
    const response = await createTestSignInRoute({
      isEnabled: () => true,
      supabaseKey: "key",
      supabaseUrl: "https://abcd.supabase.co",
    })(post(credentials))

    expect(createClient).toHaveBeenCalledWith("https://abcd.supabase.co", "key")
    expect((await response.json()).storageKey).toBe("sb-abcd-auth-token")
  })

  it("answers 401 for rejected credentials", async () => {
    signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    })
    const response = await createTestSignInRoute({ isEnabled: () => true })(
      post(credentials)
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: "Invalid login credentials",
    })
  })

  it("answers 500 when the client cannot be built", async () => {
    createClient.mockRejectedValueOnce(new Error("Missing Supabase URL"))
    const response = await createTestSignInRoute({ isEnabled: () => true })(
      post(credentials)
    )

    expect(response.status).toBe(500)
    expect((await response.json()).error).toContain("Missing Supabase URL")
  })
})
