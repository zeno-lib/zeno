# `@zeno-lib/e2e` — Intent

Playwright end-to-end tooling for the workspace, published as a reusable package so other monorepos (for example `resolve`) share the same Playwright preset and dependency verifier. This repo's own suite dogfoods the published exports.

## Purpose & Scope

Two published pieces, plus this repo's per-app specs that consume them:

- `@zeno-lib/e2e/config`: a `baseConfig` Playwright preset (browsers, reporter, retries, timeout, trace) with no `webServer`/`testDir`.
- `@zeno-lib/e2e/verify-deps`: `verifyAppDeps()` and the `zeno-verify-app-deps` bin, a parameterized checker that keeps a Turborepo `^build` graph honest.

**Owns:** the shared Playwright defaults, the dependency-verification tool, this repo's specs.

**Does NOT own:** unit tests (Vitest, alongside source), staging/prod smoke tests, test data seeding, and the app-specific `webServer`/`testDir` (the consumer supplies those).

## Entry Points & Contracts

Layout:

```
packages/e2e/
├── src/
│   ├── config.ts                    # published: @zeno-lib/e2e/config
│   ├── verify-deps.ts               # published: @zeno-lib/e2e/verify-deps
│   └── verify-deps-cli.ts           # published: zeno-verify-app-deps bin
├── dist/                            # tsdown output (published)
├── tsdown.config.ts
├── playwright.config.ts             # repo-only: consumes @zeno-lib/e2e/config
└── tests/<app-dir-name>/*.spec.ts   # repo-only; <dir> must match apps/<dir>
```

Published surface:

| Import | Provides |
|---|---|
| `@zeno-lib/e2e/config` | `baseConfig` Playwright preset (import `defineConfig`/`devices` directly from `@playwright/test`) |
| `@zeno-lib/e2e/verify-deps` | `verifyAppDeps({ appsDir, testsDir, packageJsonPath }) -> { ok, checked, missing }` |
| `zeno-verify-app-deps` (bin) | CLI wrapper: `--apps-dir` (default `../../apps`), `--tests-dir` (default `./tests`), `--package-json` (default `./package.json`) |

`baseConfig` omits `webServer` and `testDir` on purpose. Consumers spread it and add their own. It reads `process.env.CI` at run time for `forbidOnly`/`retries`/`timeout`/`reporter`.

`verifyAppDeps` checks the union of `dependencies` and `devDependencies`, so an app can be listed under either field.

Scripts (`package.json`): `build` (tsdown), `types:check` (`tsc --noEmit`), `e2e` (`playwright test`), `e2e:watch` (`playwright test --ui`), `verify-deps` (runs the built `verify-deps-cli.mjs` directly, since pnpm does not link this leaf package's own bin; external consumers invoke it as the `zeno-verify-app-deps` bin).

Turbo wiring: `build` produces `dist/` before `verify-deps` and `e2e` (both depend on `build`), and `e2e` also depends on `^build` so the tested apps are built first.

Adding a new tested app: (1) create `tests/<app-dir-name>/` with at least one spec, (2) add the app as a `devDependency` (workspace protocol), (3) add its server to the `webServer` array in `playwright.config.ts`.

## Usage Patterns

Run the repo suite locally (reuses an existing dev server on port 5002 if one is up):

```bash
pnpm exec playwright install --with-deps   # one-time, in this package
pnpm turbo run e2e --filter @zeno-lib/e2e
```

Consume the preset elsewhere:

```ts
import { defineConfig } from "@playwright/test"
import { baseConfig } from "@zeno-lib/e2e/config"

export default defineConfig({
  ...baseConfig,
  testDir: "./tests",
  webServer: { command: "npm run start", url: "http://localhost:3000" },
})
```

Author a spec (the tests folder name must match the app directory name under `apps/`):

```ts
import { expect, test } from "@playwright/test"

test("description", async ({ page }) => {
  const response = await page.goto("http://localhost:5002/<path>", {
    waitUntil: "networkidle",
  })
  expect(response?.status()).toBe(200)
})
```

## Anti-patterns

- **Don't add `webServer`/`testDir` to `baseConfig`.** Those are app-specific and belong in the consumer's config; the preset stays reusable only if it omits them.
- **Don't add a spec under `tests/<dir>/` whose `<dir>` doesn't match an actual app directory name.** `verifyAppDeps` only matches folders that have a sibling `apps/<dir>` with a `package.json`.
- **Don't hardcode `localhost:3000`.** The docs app runs on `5002`; new apps should pick non-default ports too.
- **Don't disable `forbidOnly`.** `baseConfig` enables it only in CI; flipping that ships a stray `test.only` green.
- **Don't move an app under test into `dependencies`.** Apps stay in `devDependencies` so they never ship in the published package; Turbo's `^build` still builds them because its graph includes devDependencies.

## Dependencies & Edges

- **Peer:** `@playwright/test` (`>=1`). Consumers install it; the repo also keeps it as a devDependency for its own tests and for dts generation.
- **Apps under test** are listed in `devDependencies` (workspace protocol). `verifyAppDeps` enforces this and prints the exact JSON snippet to add when one is missing.
- **Build:** `tsdown` bundles `src/` to `dist/`; `@playwright/test` is marked `external` so it stays a bare specifier in the output.
- After `pnpm install`, run `pnpm exec playwright install --with-deps` once in this package to download browser binaries.

## Pitfalls

- **The repo's `playwright.config.ts` and `verify-deps` script consume the built `dist/`,** so `build` must run first. Turbo handles this (`verify-deps` and `e2e` depend on `build`); if you invoke Playwright directly, run `pnpm turbo run build --filter @zeno-lib/e2e` beforehand.
- **`verifyAppDeps` is the contract enforcement point** for Turbo's `^build`. If an app under test is not a workspace dep, Turbo runs e2e against a stale build and the failure is non-obvious. Run `pnpm turbo run verify-deps --filter @zeno-lib/e2e` after restructuring.
- **`webServer.reuseExistingServer: !process.env.CI`** means locally Playwright reuses a dev server already on the port (HMR, not the production build), which can mask production-only bugs. Kill the dev server for a trustworthy local run.
- **CI test timeout is 30s, local is 120s** (from `baseConfig`). A test that slowly polls a network-idle page can pass locally and time out in CI.
- **`reporter` is `html` in CI**, writing to `playwright-report/`, which should stay in `.gitignore`.
