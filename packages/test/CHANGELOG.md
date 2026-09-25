# @zeno-lib/test

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
