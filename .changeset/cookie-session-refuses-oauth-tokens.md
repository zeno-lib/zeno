---
"@zeno-lib/db": minor
---

`getRequestContext` now refuses a session whose token carries `client_id`, a token issued to an OAuth client, with `UnauthenticatedError`. Such a token carries the user's full rights, and with its refresh token it makes a valid cookie session, so whoever held it could run every server action as the user. It still works through `getBearerContext`.
