# `@zeno-lib/e2e` — Intent

Playwright end-to-end suite for every app in the workspace. Note the package name is `@zeno-lib/e2e` (not `@zeno-lib/e2e`) — keep that scope when referring to it.

## Purpose & Scope

Cross-app browser tests run against the production builds of apps under `apps/`. Each tested app has its own subdirectory under `tests/` whose name **must match the app's directory name** under `apps/`.

**Owns:** the Playwright config, the per-app test specs, the dependency-verification script that keeps Turbo's build graph honest.

**Does NOT own:** unit tests (those live alongside source via Vitest), staging/prod smoke tests (separate concern), test data seeding.

## Entry Points & Contracts

Layout:

```
packages/e2e/
├── playwright.config.ts
├── verify-app-deps.mjs        # Turbo dep-graph verifier (see Pitfalls)
└── tests/
    └── <app-dir-name>/        # e.g. tests/docs/ for apps/docs/
        └── *.spec.ts
```

Scripts (`package.json`):
- `e2e` — `playwright test` (CI mode runs `forbidOnly`, retries 3, html reporter)
- `e2e:watch` — `playwright test --ui`
- `verify-deps` — runs `verify-app-deps.mjs`

Turbo wiring: `verify-deps` must complete before `e2e`, and `e2e` depends on `^build` so apps are built before Playwright boots their `next start` server.

`webServer` config (`playwright.config.ts:68-75`) currently boots the docs app:

```
cd ../../apps/docs && npm run start -- -p 5002
```

Adding a new tested app means: (1) creating `tests/<app-dir-name>/` with at least one spec, (2) adding the app as a workspace dep in this package's `package.json`, (3) appending another entry to the `webServer` array.

## Usage Patterns

Run against the docs app locally (uses an existing dev server if one is already on port 5002):

```bash
pnpm exec playwright install --with-deps   # one-time, in this package
pnpm turbo run e2e --filter @zeno-lib/e2e
```

Author a new spec for the docs app:

```ts
// tests/docs/<feature>.spec.ts
import { expect, test } from "@playwright/test"

test("description", async ({ page }) => {
  const response = await page.goto("http://localhost:5002/<path>", { waitUntil: "networkidle" })
  expect(response?.status()).toBe(200)
})
```

The existing `tests/docs/example.spec.ts` is the canonical minimal shape.

## Anti-patterns

- **Don't add a spec under `tests/<dir>/` whose `<dir>` doesn't match an actual app directory name.** `verify-app-deps.mjs` walks `tests/` looking for matching `apps/<dir>` and will pass-through any orphan folder, so the spec will run against an unbuilt app and confusingly fail.
- **Don't hardcode `localhost:3000` in tests.** The docs app runs on `5002`; new apps should pick non-default ports too. Prefer reading from `webServer.url` patterns or extracting a base URL constant per app.
- **Don't disable `forbidOnly`.** It's already off in dev and on in CI; flipping the CI behaviour means a stray `test.only` ships green.

## Dependencies & Edges

Workspace deps: each app under test must be listed in this package's `dependencies` (workspace protocol). The `verify-deps` script enforces this and prints the exact JSON snippet to add when an app is missing.

Tooling: `@playwright/test@1.59.1`. After `pnpm install`, **every developer must run `pnpm exec playwright install --with-deps` once inside this package** to download browser binaries (per `README.md`).

## Pitfalls

- **`verify-app-deps.mjs` is the contract enforcement point** for Turbo's `^build` to actually rebuild the app before tests. If you skip listing an app as a workspace dep, Turbo runs e2e against whatever stale build sits on disk and the failure is non-obvious. Always run `pnpm turbo run verify-deps --filter @zeno-lib/e2e` after restructuring.
- **`webServer.reuseExistingServer: !process.env.CI`** — locally, Playwright will reuse a dev server you already started; in CI it always boots a fresh `next start`. So locally with a running `pnpm dev`, e2e tests hit the dev server (HMR enabled), not the production build, which can mask production-only bugs. For trustworthy local runs, kill the dev server first.
- **CI test timeout is 30s, local is 120s** (`playwright.config.ts:57`). Tests that pass locally because they slowly poll a network-idle page can time out in CI; budget accordingly.
- **`reporter: process.env.CI ? "html" : "list"`** — HTML reports go to a `playwright-report/` directory that should not be committed; ensure it stays in `.gitignore`.
