# `@zeno-lib/sentry`

The Sentry setup a Next.js app shares across its browser, Node.js and edge configs. The user guide
is in [`monitoring/bug-tracking`](../../apps/docs/content/docs/production/monitoring/bug-tracking.mdx).

## Rules

- **`groupServerReportedErrors` is browser only.** On the server the original error carries the
  same `digest`, so it would merge every server error from a page into one issue.
- **Write `process.env.NEXT_PUBLIC_ENVIRONMENT` out in full.** Next.js inlines it into the browser
  bundle by matching that text; a destructured or computed read stays `undefined` there, which
  turns Sentry off without an error.
- **Never default `enabled` to `NODE_ENV`.** `next start` runs as `production` on previews and in
  CI, so every test run would report.
- **Keep `@sentry/*` in tsdown's `deps.neverBundle`.** The app must resolve the SDK build for each
  runtime. A bundled copy pins one build, and when its version differs from the app's it keeps its
  own scopes, so the `digest` tag would miss the app's events.
- **Wrap only what `@sentry/nextjs` doesn't document.** The tunnel, Replay and `withSentryConfig`
  stay in the app's own configs, as the docs page shows.
