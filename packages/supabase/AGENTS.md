# `@zeno-lib/supabase`

Wraps `@supabase/ssr` for the Next.js App Router. Its value is keeping the client, server and
middleware split honest. The user guide is in
[`data-management/supabase`](../../apps/docs/content/docs/core-framework/data-management/supabase.mdx).

## Middleware rules

- **Put no code between `createServerClient(...)` and `supabase.auth.getClaims()`, and never remove
  the `getClaims()` call.** It refreshes the session, and extra logic there has caused "users
  randomly logged out" incidents.
- **`getClaims()`, never `getUser()`.** `getUser()` is an Auth round trip per request, and a slow or
  failed one reads as signed out, which redirects the request and drops a Server Action in flight.
- **An unauthenticated Server Action gets a `401`, not a redirect** (detected by the `Next-Action`
  header). A redirect resolves the action without running it, so the write is lost silently.
- **Never mutate the `supabaseResponse` cookies after `updateSession`.** Return it as is, or follow
  the copy procedure in the file's trailing comment.
- **`signInPath` must be in `publicPaths`**, or unauthenticated users loop. Only `/sign-in` is exempt
  by default, so sign-up, recovery and the confirm route need adding.

## Client rules

- **`next-client` in browser code, `next-server` in server code.** A misplaced call returns a usable
  client that silently loses auth state on navigation.
- **The server `createClient` is async.** A missing `await` type-checks as a `Promise` but every
  method resolves to `undefined` at runtime.
- **`createAdminClient` bypasses RLS** (it defaults to `SUPABASE_SECRET_KEY`). Keep it server-side.

## Test sign-in route

- **Gate `createTestSignInRoute` on your own environment variable, never `NODE_ENV`.** `next start`
  runs as `production`, which is often how CI drives Playwright. It lives here, not in
  `@zeno-lib/e2e`, because it needs `next` and the cookie-backed server client.
- **The route is called without a session**, so it must be in `publicPaths` or outside the
  middleware matcher, wherever `isEnabled` can return `true`.

## Traps

- **`loaderFile` needs a default-exporting, project-relative file**, and `next-image-loader` exports
  a named `supabaseImageLoader`. Consumers add a one-line re-export; pointing `loaderFile` at the
  package fails silently.
- **The image loader throws at request time** when the project id env var is missing, which shows up
  as a broken image, not a build failure.
- **Keep `next/*` in tsdown's `external`.** `next` has no exports map, so bundled imports would emit
  as `next/headers.js`.
