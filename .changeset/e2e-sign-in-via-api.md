---
"@zeno-lib/e2e": minor
---

Add `@zeno-lib/e2e/auth`. `signInViaApi({ page, url, email, password })` signs a user in through a test sign-in route, installs the Supabase SSR auth cookie (base64url, chunked like `@supabase/ssr`) in the browser context, and broadcasts `SIGNED_IN` to open clients. The cookie and channel name come from the route's response, or `supabaseStorageKey(supabaseUrl)`, instead of being hard-coded. Also exports `signOut`, `broadcastAuthEvent` and `sessionCookieValues`.
