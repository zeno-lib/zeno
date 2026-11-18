---
"@zeno-lib/sentry": minor
---

New package: the Sentry setup a Next.js app shares across its browser, Node.js and edge configs, on `@sentry/nextjs` 11.

- `sharedOptions({ enabled, deniedQueryParams })` from `@zeno-lib/sentry/options` returns the options to spread first in each `Sentry.init`. Reporting is on only when `NEXT_PUBLIC_ENVIRONMENT` is `production`, unless you pass `enabled`. Stack frame variables are off, because minified server bundles hide a secret's name from the SDK's filter. The PKCE `code` query param is filtered on top of the SDK's own list. Browser network failures that got no answer (`Failed to fetch`, `Load failed` and their Firefox and Safari wordings) are dropped.
- `onRequestError` from `@zeno-lib/sentry/request-error` replaces `Sentry.captureRequestError` in `instrumentation.ts` and tags the event with the Next.js `digest`.
- `groupServerReportedErrors` from `@zeno-lib/sentry/before-send` is a browser `beforeSend`. It tags the redacted browser copy of a server error with the same `digest`, so `digest:<value>` finds both events, and groups the copies by page so they keep their replay without opening a duplicate issue. A fingerprint the app set wins, and Next.js control flow (`redirect()`, `notFound()`, `forbidden()`, `unauthorized()`) is left to default grouping.
