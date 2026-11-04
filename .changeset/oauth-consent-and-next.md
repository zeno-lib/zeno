---
"@zeno-lib/authentication": minor
---

Registry items for Supabase Auth's OAuth 2.1 server: `oauth-consent` (the consent page: sign in and back, then allow or deny an app), `connected-apps` (the apps a user allowed, with Disconnect) and `oauth-clients` (admins register, rotate and delete OAuth clients through server actions behind an access check that refuses everyone until you fill it in).

The sign-in flows return to the page's `next` query parameter when it is a path on your app, and `confirm` now follows `next` only when it is one too. It used to redirect to any URL, including another site's.
