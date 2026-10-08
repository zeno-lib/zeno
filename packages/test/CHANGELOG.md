# @zeno-lib/test

## 0.1.1

### Patch Changes

- 707eaf0: Lint fixes for Biome 2.5 and Ultracite 7.12, with no behavior change.
  `ActionSchema.parse` and the `RlsTestHarness` members are now declared as
  function-typed properties instead of methods.
- e9ff3ff: Update `@testing-library/react` to 16.3.3, `@testing-library/user-event` to
  14.6.7 and `@vitejs/plugin-react` to 6.1.2.
- 875a047: Update `jsdom` to 30.1.2. jsdom 30 supports Node `^22.22.2 || ^24.15.0 || >=26`,
  so the React preset now needs at least Node 24.15 on the 24 line.
- 29fc2e3: The `vitest` peer range accepts Vitest 5 (`^4.1.0 || ^5.0.0`), the version the
  presets are built and tested against.

## 0.1.0

### Minor Changes

- 4c5d7a7: Add `@zeno-lib/test/supabase`, an RLS test harness for Supabase. `createRlsTestHarness({ admin, client, createDb?, onCreateUser? })` creates real Auth users through the admin API, signs them in on one publishable-key client, and exposes a database handle bound to that client (pass `createAuthClient` from `@zeno-lib/db`), so one handle is `anon` while signed out and the user after sign-in. Domain setup such as role rows goes in `onCreateUser`. `cleanUp()` retries transient Auth errors (`AuthRetryableFetchError`, 429, 502–504) a bounded number of times, treats an already-deleted user as deleted, and still signs out and closes the handle when a delete fails. Also exports `signInAs`, `idsSeen` and `deleteAuthUser`. `@supabase/supabase-js` is a new optional peer dependency.

## 0.0.3

### Patch Changes

- 448249c: Stop re-exporting vitest

## 0.0.2

### Patch Changes

- 478dd8f: Put vitest and vite in peerDependencies. Use tsdown to bundle package.

## 0.0.1

### Patch Changes

- 439319c: First npm release
