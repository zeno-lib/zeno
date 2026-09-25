# @zeno-lib/e2e

## 0.1.0

### Minor Changes

- 4c5d7a7: Add `@zeno-lib/e2e/auth`. `signInViaApi({ page, url, email, password })` signs a user in through a test sign-in route, installs the Supabase SSR auth cookie (base64url, chunked like `@supabase/ssr`) in the browser context, and broadcasts `SIGNED_IN` to open clients. The cookie and channel name come from the route's response, or `supabaseStorageKey(supabaseUrl)`, instead of being hard-coded. Also exports `signOut`, `broadcastAuthEvent` and `sessionCookieValues`.

## 0.0.2

### Patch Changes

- a2412e4: First usable release. Ship a shared Playwright `baseConfig` preset via `@zeno-lib/e2e/config` and a parameterized app-dependency verifier via `@zeno-lib/e2e/verify-deps` (plus the `zeno-e2e` CLI).

## 0.0.1

### Patch Changes

- 439319c: First npm release
  - @zeno-lib/docs@0.0.1
