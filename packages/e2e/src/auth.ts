import type { APIRequestContext, Page } from "@playwright/test"

/** The session JSON a test sign-in route returns (Supabase's `Session`). */
export interface ApiSession {
  access_token: string
  expires_at?: number
  expires_in: number
  refresh_token: string
  token_type: string
  user: unknown
}

export type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT"

// `@supabase/ssr` defaults: 400 days, and chunks past 3180 URI-encoded chars.
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60
const MAX_CHUNK_SIZE = 3180

/**
 * The auth storage key `supabase-js` derives from a project URL,
 * `sb-<first hostname label>-auth-token`. It is both the SSR cookie name and
 * the `BroadcastChannel` name the browser client listens on:
 * `http://127.0.0.1:54321` gives `sb-127-auth-token`, and
 * `https://abcd.supabase.co` gives `sb-abcd-auth-token`.
 */
export const supabaseStorageKey = (supabaseUrl: string): string =>
  `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`

/**
 * The cookies `@supabase/ssr` would write for `session`: a `base64-` prefixed
 * base64url JSON value, split into `<key>.0`, `<key>.1`, … once it outgrows one
 * cookie. Base64url is ASCII, so the URI-encoded length is the length.
 */
export const sessionCookieValues = (
  storageKey: string,
  session: ApiSession
): { name: string; value: string }[] => {
  const value = `base64-${Buffer.from(JSON.stringify(session), "utf8").toString("base64url")}`
  if (value.length <= MAX_CHUNK_SIZE) {
    return [{ name: storageKey, value }]
  }
  const chunks: { name: string; value: string }[] = []
  for (let start = 0; start < value.length; start += MAX_CHUNK_SIZE) {
    chunks.push({
      name: `${storageKey}.${chunks.length}`,
      value: value.slice(start, start + MAX_CHUNK_SIZE),
    })
  }
  return chunks
}

/**
 * Tells an open Supabase browser client about an auth change, the way another
 * tab would. Only reaches clients on the page's current origin, so navigate to
 * the app first if an already-mounted client must pick up the session.
 */
export const broadcastAuthEvent = async ({
  event,
  page,
  session,
  storageKey,
}: {
  event: AuthEvent
  page: Page
  session: ApiSession | null
  storageKey: string
}): Promise<void> => {
  await page.evaluate(
    ({ channelName, event: newEvent, session: newSession }) => {
      const channel = new BroadcastChannel(channelName)
      channel.postMessage({ event: newEvent, session: newSession })
      channel.close()
    },
    { channelName: storageKey, event, session }
  )
}

/** Clears the browser context's cookies and broadcasts `SIGNED_OUT`. */
export const signOut = async ({
  page,
  storageKey,
}: {
  page: Page
  storageKey: string
}): Promise<void> => {
  await page.context().clearCookies()
  await broadcastAuthEvent({
    event: "SIGNED_OUT",
    page,
    session: null,
    storageKey,
  })
}

export interface SignInViaApiOptions {
  email: string
  page: Page
  password: string
  /** Defaults to `page.request`, which shares the page's cookie jar. */
  request?: APIRequestContext
  /**
   * Overrides the storage key the route reports. Needed only if the route
   * predates `storageKey` in its response, or the app sets a custom one.
   */
  storageKey?: string
  /** Full URL of the test sign-in route, e.g. `http://localhost:3100/api/test/sign-in`. */
  url: string
}

const readSignInResponse = async (
  response: Awaited<ReturnType<APIRequestContext["post"]>>,
  url: string
): Promise<{ session: ApiSession; storageKey?: string }> => {
  if (!response.ok()) {
    throw new Error(
      `Test sign-in at ${url} failed with ${response.status()}: ${await response.text()}`
    )
  }
  const body = (await response.json()) as {
    session?: ApiSession | null
    storageKey?: string
  }
  if (!body.session?.access_token) {
    throw new Error(`Test sign-in at ${url} returned no session`)
  }
  return body.storageKey
    ? { session: body.session, storageKey: body.storageKey }
    : { session: body.session }
}

/**
 * Signs `email` in through an env-gated test sign-in route (see
 * `createTestSignInRoute` in `@zeno-lib/supabase/next-test-sign-in`), installs
 * the SSR auth cookie in the page's browser context, and broadcasts
 * `SIGNED_IN`. Starts from a signed-out context every time.
 *
 * Seeding the user is not this helper's job: sign in a user your fixtures or
 * seed already created.
 */
export const signInViaApi = async ({
  email,
  page,
  password,
  request = page.request,
  storageKey: storageKeyOverride,
  url,
}: SignInViaApiOptions): Promise<ApiSession> => {
  const response = await request.post(url, { data: { email, password } })
  const { session, storageKey: reported } = await readSignInResponse(
    response,
    url
  )
  const storageKey = storageKeyOverride ?? reported
  if (!storageKey) {
    throw new Error(
      `Test sign-in at ${url} reported no storageKey; pass one, e.g. supabaseStorageKey(supabaseUrl)`
    )
  }

  await signOut({ page, storageKey })

  const { hostname, protocol } = new URL(url)
  const expires = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS
  await page.context().addCookies(
    sessionCookieValues(storageKey, session).map(({ name, value }) => ({
      domain: hostname,
      expires,
      httpOnly: false,
      name,
      path: "/",
      sameSite: "Lax" as const,
      secure: protocol === "https:",
      value,
    }))
  )

  await broadcastAuthEvent({ event: "SIGNED_IN", page, session, storageKey })
  return session
}
