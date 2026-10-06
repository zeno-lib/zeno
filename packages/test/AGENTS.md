# `@zeno-lib/test`

The shared Vitest presets (`./configs`) and the Supabase RLS harness (`./supabase`). The user guide is
in [`testing/unit-testing`](../../apps/docs/content/docs/core-framework/testing/unit-testing.mdx);
`packages/db/test/rls.integration.test.ts` is the in-repo example to copy.

## Harness rules

- **`createDb(client)` runs once, so the handle must re-read the session on every query.** It is
  `anon` while signed out and the user after `signIn`. Never rebuild `db` on sign-in; suites capture
  `harness.db` in `describe` scope.
- **A user is tracked before `onCreateUser` runs**, so a throwing callback still gets cleaned up.
  Keep that order.
- **`cleanUp()` runs every step even when one fails**, rethrowing one failure as is and several as
  `TestCleanupError`.
- **`deleteAuthUser` treats `user_not_found` as deleted** and retries only retryable Auth errors
  (`AuthRetryableFetchError`, 429, 502, 503, 504).
- **Errors are matched by shape, not `instanceof`**, so a second `auth-js` copy still works. Keep it
  that way; `@supabase/supabase-js` is an optional, type-only peer.
- **Never depend on `@zeno-lib/db`.** `db` dev-depends on this package, and not every consumer uses
  Drizzle.

## Traps

- **Access-token hooks read roles when the token is minted.** Granting claims to a signed-in user
  doesn't apply them, which is why `signInAs` creates a fresh user.
- **`supabase-js` returns `{ error }` instead of throwing.** An unchecked `onCreateUser` insert
  makes a missing role row read as an RLS denial.
- **Delete rows that reference the users before `cleanUp()`.** A `not null` foreign key to
  `auth.users` without `on delete cascade` makes GoTrue answer 500, which isn't retried.
- **Use one harness per suite**, never `admin` for the reads under test, and call
  `refreshCurrentUser()` when something else changed the session.
- **`dist/` is committed** (`bundle-packages.yml`). The package's own `vitest.config.ts` imports
  `./src/configs/default.ts` relatively, because `@zeno-lib/test/configs` resolves to its `dist/`.
