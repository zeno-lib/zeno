---
"@zeno-lib/supabase": minor
---

Add `@zeno-lib/supabase/next-test-sign-in`, a test-only entry. `createTestSignInRoute({ isEnabled })` returns a Next.js Route Handler that signs a user in with email and password through the cookie-backed server client and answers `{ session, storageKey }`, for `signInViaApi` from `@zeno-lib/e2e/auth`. `isEnabled` is required and evaluated on every request; when it returns `false` the route answers `404`.
