---
"@zeno-lib/db": minor
---

Add `sessionRevocation` to `createAuthClient`, `createSupabaseClient` and `createRequestDb`, which refuses a session the server ended with `SessionRevokedError`, and `authUserRevocation` to `@zeno-lib/db/auth` for banned and deleted users. `UnauthenticatedError` and `SessionRevokedError` are now also exported from `@zeno-lib/db`.
