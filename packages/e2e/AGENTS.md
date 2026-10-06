# `@zeno-lib/e2e`

The published Playwright preset (`./config`), dependency verifier (`./verify-deps` and the
`zeno-e2e` bin) and API sign-in helpers (`./auth`), plus this repo's own specs, which dogfood them.
The user guide is in
[`testing/e2e-testing`](../../apps/docs/content/docs/core-framework/testing/e2e-testing.mdx).

## Rules

- **`tests/<dir>/` must match an app directory, `apps/<dir>`.** `verifyAppDeps` only matches folders
  with a sibling `apps/<dir>/package.json`.
- **Apps under test stay in `devDependencies`**, never `dependencies`, so they never ship in the
  package. Turbo's `^build` still builds them. If one is missing, Turbo runs e2e against a stale
  build and the failure is not obvious, so run `pnpm turbo run verify-deps --filter @zeno-lib/e2e`
  after restructuring.
- **Adding a tested app takes three changes:** `tests/<app-dir>/` with a spec, the app as a
  workspace `devDependency`, and its server in the `webServer` array of `playwright.config.ts`.
- **`baseConfig` never gets a `webServer`**, which is app-specific, and never loses `forbidOnly` in
  CI, which would ship a stray `test.only` green.
- **Never hardcode the auth cookie name.** It derives from the Supabase URL, and the sign-in route
  reports it.
- **New apps pick a non-default port.** The docs app is on 5002.
- **`dist/` is gitignored and built at publish by `prepack`**, unlike `@zeno-lib/test` and
  `@zeno-lib/supabase`, whose `dist/` is committed. Nothing imports this package during `pnpm dev`.

## Traps

- **The repo's `playwright.config.ts` and `verify-deps` script read the built `dist/`.** Turbo builds
  it first; if you run Playwright directly, run `pnpm turbo run build --filter @zeno-lib/e2e`
  before.
- **The `verify-deps` script runs `node ./dist/cli.mjs verify-deps`**, because pnpm doesn't link a
  package's own bin. External consumers run `zeno-e2e verify-deps`.
- **Locally, Playwright reuses a dev server already on the port** (`reuseExistingServer`), which can
  hide production-only bugs. Kill the dev server for a trustworthy run.
- **The test timeout is 30s in CI and 120s locally**, so slow polling can pass locally and fail in CI.
- **`broadcastAuthEvent` only reaches the page's current origin.** On `about:blank` it does nothing,
  and the cookie still signs the next navigation in.
