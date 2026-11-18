# `@zeno-lib/sentry`

The Sentry setup a Next.js app shares across its browser, Node.js and edge configs. The user guide
is in [`monitoring/bug-tracking`](../../apps/docs/content/docs/production/monitoring/bug-tracking.mdx).

## Rules

- **No root `index.ts` barrel, and never import `request-error` from another entry.** It imports
  `captureRequestError`, which the browser build of `@sentry/nextjs` doesn't export, so the
  browser configs would fail to bundle.
- **`groupServerReportedErrors` is browser only.** On the server the original error carries the
  same `digest`, so it would merge every server error from a page into one issue.
- **Write `process.env.NEXT_PUBLIC_ENVIRONMENT` out in full.** Next.js inlines it into the browser
  bundle by matching that text; a destructured or computed read stays `undefined` there, which
  turns Sentry off without an error.
- **Never default `enabled` to `NODE_ENV`.** `next start` runs as `production` on previews and in
  CI, so every test run would report.
- **Keep `@sentry/*` in tsdown's `deps.neverBundle`.** The app must resolve the SDK build for each
  runtime, and a bundled copy has its own scope, so the `digest` tag would never reach the app's
  events.
- **Wrap only what `@sentry/nextjs` doesn't document.** The tunnel, Replay and `withSentryConfig`
  stay in the app's own configs, as the docs page shows.
