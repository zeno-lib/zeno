# `@zeno-lib/test` — Intent

Shared Vitest presets plus an RLS test harness for Supabase, published so other monorepos test the same way this one does.

## Purpose & Scope

- `@zeno-lib/test/configs`: `defaultConfig` (Node, `{src,test,tests}/**/*.test.ts`, `.env.test` loaded, type tests on) and `reactConfig` (jsdom + React plugin), plus a re-export of `vitest/config`.
- `@zeno-lib/test/testing-library`, `@zeno-lib/test/user-event`: thin re-exports.
- `@zeno-lib/test/supabase`: the RLS harness. Creates real Auth users through the admin API, signs them in on one publishable-key client, exposes a session-bound database handle, and cleans up.

**Owns:** the Vitest defaults, the harness's user lifecycle (create → sign in/out → delete) and its cleanup robustness.

**Does NOT own:** a database client (the consumer passes `createDb`, typically `@zeno-lib/db`'s `createAuthClient`), domain setup such as role or membership rows (the consumer's `onCreateUser`), seeding fixtures, or starting Supabase.

## Entry Points & Contracts

`@zeno-lib/test/supabase`:

| Export | Contract |
|---|---|
| `createRlsTestHarness({ admin, client, createDb?, onCreateUser?, createUserAttributes?, password?, retry? })` | `admin`: service-role client (only creates/deletes users). `client`: publishable-key client (signs in/out). `createDb(client)` runs **once**; the handle must re-read the session per query, so it is `anon` while signed out and the user after `signIn`. Returns `{ client, db, users, currentUser, createUser, createUserAndSignIn, signIn, signOut, deleteUser, refreshCurrentUser, cleanUpUsers, cleanUp }`. |
| `createUser({ ...AdminUserAttributes, options? })` | Defaults: random `zeno-test-<uuid>@example.test`, `email_confirm: true`, `password` (default `"zeno-test-password"`). The user is tracked **before** `onCreateUser(user, options, { admin })` runs, so a throwing callback still gets cleaned up. `options` is typed from the callback's annotation. |
| `signIn` / `signOut` | `signIn` keeps `currentUser` from the sign-in response. `signOut` is `scope: "local"`: no Auth round trip. |
| `cleanUp()` | Deletes users, signs out, then calls `db.close()` if it exists. Every step runs even when an earlier one failed; one failure is rethrown as is, several as `TestCleanupError` (`errors`). |
| `deleteAuthUser(admin, id, retry?)` | Retries a retryable Auth error (`AuthRetryableFetchError`, or status 429/502/503/504), returned or thrown, `attempts` times (default 4) with doubling `delayMs` (default 200). `user_not_found`/404 counts as deleted. Anything else throws at once. |
| `signInAs(harness, options \| null)` | Signs out, then signs in a **fresh** user created with `options`; `null` stays signed out (`anon`). |
| `idsSeen(read, key?)` | `Set` of `row.id` (or `key(row)`) from a read. |
| `isRetryableAuthError`, `isUserNotFoundError`, `TestCleanupError` | The predicates and error the above use. |

`HarnessClient` / `HarnessAdminClient` are structural slices of `SupabaseClient["auth"]`, so any `SupabaseClient<Database>` fits and a typed `admin` reaches `onCreateUser` with its `Database` intact.

## Usage Patterns

```ts
import { createClient } from "@supabase/supabase-js"
import { createAuthClient } from "@zeno-lib/db"
import { createRlsTestHarness, idsSeen, signInAs } from "@zeno-lib/test/supabase"

const harness = createRlsTestHarness({
  admin: createClient(url, secretKey),
  client: createClient(url, publishableKey),
  createDb: (client) => createAuthClient(client, { relations }),
  onCreateUser: async (user, options: { roles?: Role[] } | undefined, { admin }) => {
    for (const role of options?.roles ?? []) {
      const { error } = await admin.from("users_roles").insert({ role, user_id: user.id })
      if (error) throw error
    }
  },
})
afterAll(() => harness.cleanUp())

it("admins see every deal", async () => {
  await signInAs(harness, { roles: ["ADMIN"] })
  expect(await idsSeen(() => harness.db.select().from(deals))).toEqual(new Set([1, 2]))
})
```

This repo dogfoods it in `packages/db/test/rls.integration.test.ts`.

## Anti-patterns

- **Don't rebuild `db` on sign-in.** Suites capture `harness.db` in `describe` scope; it follows the session by design.
- **Don't grant claims to a signed-in user and expect them to apply.** Access-token hooks read roles when the token is minted; `signInAs` makes a fresh user for that reason.
- **Don't swallow `onCreateUser` insert errors.** `supabase-js` returns `{ error }` instead of throwing; check it, or a missing role row reads as an RLS denial.
- **Don't use `admin` for the reads under test.** It bypasses RLS.

## Dependencies & Edges

- **Peer:** `vitest ^4.1`, `vite ^6–8`; `@supabase/supabase-js >=2.56` is an **optional** peer, type-only today (errors are matched by shape, not `instanceof`, so a second `auth-js` copy still works).
- Deliberately does not depend on `@zeno-lib/db` (`db` dev-depends on this package, so that would be a cycle, and not every consumer uses Drizzle).
- **Build:** tsdown to `dist/` (committed; `bundle-packages.yml` keeps it in sync). The package's own `vitest.config.ts` imports `./src/configs/default.ts` relatively, since `@zeno-lib/test/configs` resolves to its own `dist/`.

## Pitfalls

- **Delete rows that reference the users before `cleanUp()`.** A `not null` foreign key to `auth.users` without `on delete cascade` makes GoTrue answer 500, which is not retried.
- **One harness per suite.** `users` is per harness; sharing one across files mixes lifecycles.
- **`currentUser` is not re-fetched.** Call `refreshCurrentUser()` (an Auth round trip) if something else changed the session.
