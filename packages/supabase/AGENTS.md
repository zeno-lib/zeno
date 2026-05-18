# `@zeno-lib/supabase` — Intent

Thin wrapper around `@supabase/ssr` for Next.js App Router. Five files, each with a specific role; the value of this package is in keeping the client/server/middleware split honest.

## Purpose & Scope

Provides Next.js–aware factories for Supabase clients (browser, server, middleware), a custom `next/image` loader for Supabase Storage, and re-exports the few `@supabase/supabase-js` types consumers actually need.

**Owns:** the cookie wiring required for SSR auth, env-var resolution with explicit overrides, the standard Next.js middleware matcher pattern.

**Does NOT own:** auth UI (see `@zeno-lib/authentication`), database types/codegen, RLS policies, edge function deployment.

## Entry Points & Contracts

| Import | Use from | Returns / does |
|---|---|---|
| `@zeno-lib/supabase/client` | Client Components, browser code | `createBrowserClient` factory; re-exports `EmailOtpType`, `QueryData`, `SupabaseClient` types |
| `@zeno-lib/supabase/server` | Server Components, Route Handlers, Server Actions | `createServerClient` with `next/headers` cookies; **async** — must be `await`ed |
| `@zeno-lib/supabase/next-middleware` | App `middleware.ts` | Default `middleware` export + `config.matcher` |
| `@zeno-lib/supabase/supabase-middleware` | Custom middleware compositions | `updateSession(request)` — the actual cookie-refresh + auth-gate logic |
| `@zeno-lib/supabase/image-loader` | `next.config.mjs` `images.loaderFile` | Supabase Storage transformation URL builder |

Both `createClient` factories accept optional `(supabaseUrl, supabaseKey)` and fall back to `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. They throw `"Missing Supabase ... environment variables"` if neither side provides values — this is the only error path the factories own.

The image loader resolves the project ID from `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID` (preferred) or `NEXT_PUBLIC_SUPABASE_PROJECT_ID`. URLs starting with `http` pass through unchanged; relative paths are rewritten to `https://<projectId>.supabase.co/storage/v1/object/public/<src>?width=<w>&quality=<q|75>`.

## Usage Patterns

Browser:

```ts
import { createClient } from "@zeno-lib/supabase/client"
const supabase = createClient<Database>()  // Database type optional
```

Server Component / Route Handler:

```ts
import { createClient } from "@zeno-lib/supabase/server"
const supabase = await createClient<Database>()
```

Middleware (default):

```ts
// middleware.ts
export { middleware, config } from "@zeno-lib/supabase/next-middleware"
```

`next/image` loader:

```js
// next.config.mjs
export default {
  images: { loader: "custom", loaderFile: "@zeno-lib/supabase/image-loader.tsx" },
}
```

## Anti-patterns

- **Do not call `client/createClient` from server code or `server/createClient` from a client component.** Cookie state diverges; a misplaced call returns a usable object that silently loses auth state on navigation.
- **Do not put any code between `createServerClient(...)` and `supabase.auth.getUser()` in middleware** (`supabase-middleware.ts:33-36`). The official Supabase guidance — and the comment in the file — is explicit: any extra logic there has caused production "users randomly logged out" incidents. Same rule for: do not delete the `auth.getUser()` call.
- **Do not mutate the `supabaseResponse` object's cookies after `updateSession`** — return it as-is, or follow the four-step copy procedure in the file's trailing comment. Skipping this desyncs browser/server cookies.
- **Do not import `@supabase/supabase-js` types directly** in workspace packages — re-export them through this package so the dep is owned in one place. `EmailOtpType`, `QueryData`, `SupabaseClient` are already re-exported from `./client`.

## Dependencies & Edges

Peer: `@supabase/ssr >=0`, `@supabase/supabase-js >=2`, `supabase >=2`, `next >=16`. No workspace runtime deps.

Used by: `@zeno-lib/authentication` (client + server + types). Used directly by every app that needs auth.

## Pitfalls

- **Hardcoded redirect to `/login`** in `supabase-middleware.ts:48-50`. The auth package mounts at `/sign-in`, not `/login` — using both packages with default settings causes redirect loops or 404s. Either patch the middleware (fork `updateSession` and adjust the path), don't use the middleware as-is, or align route paths in the consuming app.
- **The middleware whitelists only `/login` and `/auth` prefixes** for unauthenticated users (line 41-46). Sign-up, password recovery, and the OTP confirm route are *not* whitelisted by default. If you adopt the middleware as-is, your unauthenticated users will be bounced from `/recover-password` → `/login` and the recovery flow breaks. Customise the prefix list to match your route structure.
- **Server `createClient` is async** and uses `await cookies()` — Next 15+ requires this. Forgetting `await` returns a `Promise<SupabaseClient>`, which TypeScript will catch but runtime will not (every method call resolves to `undefined`).
- **Image loader throws at request time**, not at config time, if `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID` is missing. The error surfaces as a broken image, not a build failure.
- **`scripts` is empty** — no `types:check` is wired. If you add `.ts` complexity, also add the script so `pnpm types:check` covers this package.
