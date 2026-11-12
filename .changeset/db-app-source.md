---
"@zeno-lib/db": minor
---

Add `source`, a label every transaction of a client sets as `app.source`, so an audit trigger can tell which app or job wrote a row. `createRequestDb`, `createSupabaseClient`, `createAuthClient`, `createAnonClient` and `createServiceClient` take it, and `bearer.source` gives bearer callers their own. `SourceClientConfig` is the config type of the service and anon clients.
