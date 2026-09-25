---
"@zeno-lib/db": minor
---

Add `@zeno-lib/db/next`: `createRequestDb({ supabase, relations })` returns a React-`cache`d `getRequestContext()` / `getRequestDb()` that verify the session with `getClaims()` and bind an RLS client to the full claims (throwing the exported `UnauthenticatedError` when there is no verified `sub`, never falling back to `anon`), plus `defineAction(schema, (db, input, context) => …)`, which turns a `"use server"` export into one line. `react >=19` is a new optional peer dependency, needed only by this entry.
