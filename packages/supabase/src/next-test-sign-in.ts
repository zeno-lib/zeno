import { createClient } from "./next-server"

export interface TestSignInRouteOptions {
  /**
   * The gate, evaluated on **every** request, never at import. Return `true`
   * only in development and test environments; when it returns `false` the
   * route answers `404` as if it did not exist. Required: there is no default,
   * so the route cannot ship ungated by omission.
   */
  isEnabled: () => boolean
  /** Supabase publishable key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, like `next-server`. */
  supabaseKey?: string
  /** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`, like `next-server`. */
  supabaseUrl?: string
}

const json = (body: unknown, status: number) =>
  Response.json(body, {
    headers: { "Cache-Control": "private, no-store" },
    status,
  })

/** The same `sb-<first hostname label>-auth-token` key `supabase-js` derives. */
const storageKeyFor = (supabaseUrl: string | undefined) =>
  supabaseUrl
    ? `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`
    : undefined

const readCredentials = async (request: Request) => {
  try {
    const body: unknown = await request.json()
    if (typeof body !== "object" || body === null) {
      return
    }
    const { email, password } = body as Record<string, unknown>
    return typeof email === "string" &&
      email !== "" &&
      typeof password === "string" &&
      password !== ""
      ? { email, password }
      : undefined
  } catch {
    return
  }
}

/**
 * **Test-only.** A Next.js Route Handler that signs a user in with email and
 * password through the cookie-backed server client, for Playwright to skip the
 * sign-in UI (pair it with `signInViaApi` from `@zeno-lib/e2e/auth`).
 *
 * It answers `{ session, storageKey }`, where `storageKey` is the SSR cookie
 * and `BroadcastChannel` name, so the test side need not hard-code it. The
 * server client also sets the auth cookies on the response.
 *
 * ```ts
 * // app/api/test/sign-in/route.ts
 * export const POST = createTestSignInRoute({
 *   isEnabled: () => ["development", "test"].includes(process.env.NEXT_PUBLIC_ENVIRONMENT ?? ""),
 * })
 * ```
 */
export function createTestSignInRoute({
  isEnabled,
  supabaseKey,
  supabaseUrl,
}: TestSignInRouteOptions): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!isEnabled()) {
      return json({ error: "Not found" }, 404)
    }

    const credentials = await readCredentials(request)
    if (!credentials) {
      return json({ error: "Email and password are required" }, 400)
    }

    try {
      const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
      const supabase = await createClient(url, supabaseKey)
      const { data, error } =
        await supabase.auth.signInWithPassword(credentials)

      if (error || !data.session) {
        return json({ error: error?.message ?? "Invalid credentials" }, 401)
      }

      return json(
        { session: data.session, storageKey: storageKeyFor(url) },
        200
      )
    } catch (error) {
      return json(
        {
          error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
        },
        500
      )
    }
  }
}
