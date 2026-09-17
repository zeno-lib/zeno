---
"@zeno-lib/supabase": patch
---

Set the "do not cache" headers from `@supabase/ssr` in the Next.js middleware, so a response that carries auth cookies is never cached. Peer dependencies now require `@supabase/ssr` >= 0.10.0 and `@supabase/supabase-js` >= 2.56.0.
