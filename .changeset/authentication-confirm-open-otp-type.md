---
"@zeno-lib/authentication": patch
---

The `confirm` handler type-checks against current `@supabase/supabase-js`, whose
`EmailOtpType` is now an open string union. A `type` with no default route now
redirects to `/` instead of passing `undefined` to `redirect()`.
