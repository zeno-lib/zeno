import type { init } from "@sentry/nextjs"

/** The options `Sentry.init` takes, in every runtime. */
export type SentryOptions = NonNullable<Parameters<typeof init>[0]>

export type SharedOptionsConfig = {
  /**
   * Whether this runtime sends events to Sentry. Defaults to
   * `process.env.NEXT_PUBLIC_ENVIRONMENT === "production"`, so development,
   * test, CI and preview builds stay quiet. `NODE_ENV` can't tell them apart:
   * `next build` and `next start` always run as `production`.
   */
  enabled?: boolean
  /**
   * URL query parameters whose value is replaced with `[Filtered]`, on top of
   * the SDK's own list. A key matches when it contains an entry, ignoring case.
   * Defaults to `["code"]`, the PKCE auth code on sign-in links, which no SDK
   * snippet matches. Passing a list replaces the default.
   */
  deniedQueryParams?: string[]
}

/**
 * A browser `fetch` that got no answer: the network dropped, the laptop woke
 * from sleep, the page unloaded. No change to the code can fix one, so it is
 * not reported. Chrome, Firefox and Safari each word it differently, Sentry's
 * fetch instrumentation appends the request's host, and supabase-js
 * rethrows it under its own error type with the same message. A server that
 * answers with an error status resolves `fetch`, so it is still reported. The
 * cost: a CORS or CSP block fails the same way, and is dropped too.
 */
const NETWORK_FAILURE =
  /^(?:TypeError: )?(?:Failed to fetch|Load failed|NetworkError when attempting to fetch resource\.|The network connection was lost\.|The Internet connection appears to be offline\.)(?: \(.+\))?$/u

/**
 * Options every runtime (browser, Node.js, edge) shares. Spread them first in
 * each `Sentry.init`, so a key set after the spread wins.
 *
 * `dataCollection` only keeps secrets out. Headers, cookies and query params
 * whose key contains a snippet such as `auth`, `token`, `session` or `key` are
 * always filtered by the SDK, whatever this says. Everything else is collected,
 * and denied key by key as it shows up in Sentry.
 */
export function sharedOptions({
  deniedQueryParams = ["code"],
  enabled = process.env.NEXT_PUBLIC_ENVIRONMENT === "production",
}: SharedOptionsConfig = {}) {
  return {
    dataCollection: {
      // The SDK filters local variables by name, but production server bundles
      // are minified, so a secret held in a local would go out under a mangled
      // name.
      stackFrameVariables: false,
      urlQueryParams: { deny: deniedQueryParams },
    },
    enabled,
    ignoreErrors: [NETWORK_FAILURE],
    tracesSampleRate: 1,
  } satisfies SentryOptions
}
