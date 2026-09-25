# @zeno-lib/supabase

## 0.0.5

### Patch Changes

- 6cc8e9f: `updateSession` verifies the session with `getClaims()` instead of `getUser()`, as the Supabase Next.js guide now does. With asymmetric signing keys it verifies the JWT locally, so the middleware no longer makes an Auth round trip on every request — and a slow or failed Auth call no longer reads as "signed out". An unauthenticated Server Action (a request with a `Next-Action` header) now gets a `401` instead of a redirect to `signInPath`, so the call rejects rather than resolving without running.

## 0.0.4

### Patch Changes

- 0b8794a: Set the "do not cache" headers from `@supabase/ssr` in the Next.js middleware, so a response that carries auth cookies is never cached. Peer dependencies now require `@supabase/ssr` >= 0.10.0 and `@supabase/supabase-js` >= 2.56.0.

## 0.0.3

### Patch Changes

- 341f9f7: Split plain client into createAdminClient, createAnonClient and createClient

## 0.0.2

### Patch Changes

- 4ed0309: Working release for @zeno-lib/supabase

## 0.0.1

### Patch Changes

- 439319c: First npm release
