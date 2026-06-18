# `@zeno-lib/supabase` — Intent

Thin wrapper around `@supabase/ssr` for Next.js App Router. Five files, each with a specific role; the value of this package is in keeping the client/server/middleware split honest.

## Purpose & Scope

Provides Next.js–aware factories for Supabase clients (browser, server, middleware) and a custom `next/image` loader for Supabase Storage.

**Owns:** the cookie wiring required for SSR auth, env-var resolution with explicit overrides, the standard Next.js middleware matcher pattern.

**Does NOT own:** auth UI (see `@zeno-lib/authentication`), database types/codegen, RLS policies, edge function deployment.

## Entry Points & Contracts

| Import | Use from | Returns / does |
|---|---|---|
| `@zeno-lib/supabase/client` | Client Components, browser code | `createBrowserClient` factory |
| `@zeno-lib/supabase/server` | Server Components, Route Handlers, Server Actions | `createServerClient` with `next/headers` cookies; **async** — must be `await`ed |
| `@zeno-lib/supabase/next-middleware` | App `middleware.ts` | Default `middleware` export + static `config.matcher`, plus `createMiddleware(options)` for a configured middleware |
| `@zeno-lib/supabase/supabase-middleware` | Custom middleware compositions | `updateSession(request, options?)` — the actual cookie-refresh + auth-gate logic; options set `signInPath`, `publicPaths`, `supabaseUrl`, `supabaseKey` |
| `@zeno-lib/supabase/image-loader` | `next.config.mjs` `images.loaderFile` | Supabase Storage transformation URL builder |

Both `createClient` factories accept optional `(supabaseUrl, supabaseKey)` and fall back to `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. They throw `"Missing Supabase ... environment variables"` if neither side provides values — this is the only error path the factories own. `updateSession(request, options?)` takes the same `supabaseUrl`/`supabaseKey` overrides plus `signInPath` (redirect target, default `/sign-in`) and `publicPaths` (auth-exempt prefixes, default `["/sign-in", "/auth"]`).

The image loader resolves the project ID from `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID` (preferred) or `NEXT_PUBLIC_SUPABASE_PROJECT_ID`, or from an explicit `createSupabaseImageLoader({ projectId })`. URLs starting with `http` pass through unchanged; relative paths are rewritten to `https://<projectId>.supabase.co/storage/v1/object/public/<src>?width=<w>&quality=<q|75>`.

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

`next/image` loader — `loaderFile` must be a **project-relative path to a file with a default export** (Next requirement), so re-export the named loader as default from a local file:

```ts
// image-loader.ts (in the app)
export { supabaseImageLoader as default } from "@zeno-lib/supabase/image-loader"
```

```js
// next.config.mjs
export default {
  images: { loader: "custom", loaderFile: "./image-loader.ts" },
}
```

## Anti-patterns

- **Do not call `client/createClient` from server code or `server/createClient` from a client component.** Cookie state diverges; a misplaced call returns a usable object that silently loses auth state on navigation.
- **Do not put any code between `createServerClient(...)` and `supabase.auth.getUser()` in middleware** (`supabase-middleware.ts:51-54`). The official Supabase guidance — and the comment in the file — is explicit: any extra logic there has caused production "users randomly logged out" incidents. Same rule for: do not delete the `auth.getUser()` call.
- **Do not mutate the `supabaseResponse` object's cookies after `updateSession`** — return it as-is, or follow the four-step copy procedure in the file's trailing comment. Skipping this desyncs browser/server cookies.

## Dependencies & Edges

Peer: `@supabase/ssr >=0`, `@supabase/supabase-js >=2`, `next >=16`. `next` is an **optional** peer — imported only by `server`/`next-middleware`/`supabase-middleware`. The `supabase` CLI is **not** a dependency (nothing imports it; it's a separate dev tool for generating the `Database` types). No workspace runtime deps.

Used by: `@zeno-lib/authentication` (client + server). Used directly by every app that needs auth.

## Pitfalls

- **Redirect defaults to `/sign-in`** (configurable via `signInPath`) — matches `@zeno-lib/authentication`'s `/sign-in` UI, so the two pair with no config. Invariant: `signInPath` must be in `publicPaths`, or unauthenticated users hit an infinite redirect loop (sent to sign-in → not exempt → redirected again). The defaults keep both in sync (`/sign-in` + `["/sign-in", "/auth"]`).
- **Auth-exempt prefixes default to `/sign-in` and `/auth` only** (configurable via `publicPaths`). Sign-up, password recovery, and the OTP confirm route are not exempt by default, so unauthenticated users get bounced from e.g. `/recover-password` → `/sign-in`. Pass `publicPaths` to match your route structure.
- **Server `createClient` is async** and uses `await cookies()` — Next 15+ requires this. Forgetting `await` returns a `Promise<SupabaseClient>`, which TypeScript will catch but runtime will not (every method call resolves to `undefined`).
- **Image loader throws at request time**, not at config time, if `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID` is missing. The error surfaces as a broken image, not a build failure.
- **`image-loader` is the only `next/image` integration point** and it exposes a *named* export (`supabaseImageLoader`), not a default — Next's `loaderFile` needs a default-exporting, project-relative file, so consumers must add the one-line re-export wrapper shown above. Pointing `loaderFile` straight at the package will silently fail.
- **Bundled with tsdown** — ships compiled `dist/*.mjs` + `.d.mts` (committed; un-ignored in `.gitignore`). After editing `src/`, run `pnpm --filter @zeno-lib/supabase build`; CI (`bundle-packages.yml`) also rebuilds and commits `dist` on PRs. The tsdown config's `external` list keeps `next/*` imports bare — `next` ships no exports map, so otherwise they'd emit as `next/headers.js` and break on stricter `next` versions.
