---
"@zeno-lib/supabase": patch
---

`updateSession` verifies the session with `getClaims()` instead of `getUser()`, as the Supabase Next.js guide now does. With asymmetric signing keys it verifies the JWT locally, so the middleware no longer makes an Auth round trip on every request — and a slow or failed Auth call no longer reads as "signed out". An unauthenticated Server Action (a request with a `Next-Action` header) now gets a `401` instead of a redirect to `signInPath`, so the call rejects rather than resolving without running.
