# @zeno-lib/supabase

Next.js App Router–aware factories for [Supabase](https://supabase.com) clients
(browser, server, middleware), a `next/image` loader for Supabase Storage, and
re-exports of the few `@supabase/supabase-js` types consumers actually need.

Thin wrapper around [`@supabase/ssr`](https://supabase.com/docs/guides/auth/server-side/nextjs) —
the value is in keeping the client / server / middleware split honest.

## Install

```sh
pnpm add @zeno-lib/supabase
```

Peer dependencies — install these in the consuming app. `next` is an **optional**
peer (imported only by the `server`, `next-middleware`, and `supabase-middleware`
entry points; your app already ships it):

```sh
pnpm add @supabase/ssr @supabase/supabase-js
```

The [Supabase CLI](https://supabase.com/docs/guides/api/rest/generating-types) is a
separate dev tool, **not** a dependency of this package — install it (`pnpm add -D supabase`)
or run it via `npx` when you want to generate the `Database` types used in the examples below.

## Environment variables

| Variable | Used by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `client`, `server`, `supabase-middleware` | Required. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `client`, `server`, `supabase-middleware` | Required. |
| `NEXT_PUBLIC_SUPABASE_STORAGE_PROJECT_ID` | `image-loader` | Falls back to `NEXT_PUBLIC_SUPABASE_PROJECT_ID`. |

The `client` and `server` factories accept explicit `(supabaseUrl, supabaseKey)`
arguments, and `updateSession` accepts the same through its options — all take
precedence over the env vars. If neither side supplies both values, the call throws
`Missing Supabase … environment variables`.

## Entry points

| Import | Use from | Provides |
| --- | --- | --- |
| `@zeno-lib/supabase/client` | Client Components, browser code | `createClient` (browser) + `EmailOtpType`, `QueryData`, `SupabaseClient` type re-exports |
| `@zeno-lib/supabase/server` | Server Components, Route Handlers, Server Actions | `createClient` (server, **async**) |
| `@zeno-lib/supabase/next-middleware` | App `middleware.ts` | Ready-made `middleware` + static `config`, plus the `createMiddleware(options)` factory |
| `@zeno-lib/supabase/supabase-middleware` | Custom middleware compositions | `updateSession(request, options?)` — configurable cookie-refresh + auth-gate logic |
| `@zeno-lib/supabase/image-loader` | A local `next/image` loader file | `supabaseImageLoader` + `createSupabaseImageLoader(options?)` — Storage transformation URL builder |

## Usage

### Browser (Client Components)

```ts
import { createClient } from "@zeno-lib/supabase/client"

const supabase = createClient<Database>() // Database generic is optional
```

### Server (Server Components, Route Handlers, Server Actions)

The server factory is **async** — it reads cookies via `next/headers` and must be
awaited. Forgetting `await` type-checks but fails at runtime (every method resolves
to `undefined`).

```ts
import { createClient } from "@zeno-lib/supabase/server"

const supabase = await createClient<Database>()
const {
  data: { user },
} = await supabase.auth.getUser()
```

### Middleware

Zero-config — re-export the ready-made middleware to refresh sessions and redirect
unauthenticated users to `/sign-in`:

```ts
// middleware.ts
export { middleware, config } from "@zeno-lib/supabase/next-middleware"
```

To change the redirect target or the public (auth-exempt) routes, build the middleware
with `createMiddleware`. Keep a static `config` next to it — Next requires the matcher
to be statically analyzable, so it can't come from the factory:

```ts
// middleware.ts
import { createMiddleware, config } from "@zeno-lib/supabase/next-middleware"

export const middleware = createMiddleware({
  // /sign-in is already the default; add the other public routes
  publicPaths: ["/sign-in", "/sign-up", "/auth", "/recover-password"],
})
export { config }
```

For full control, call `updateSession(request, options?)` inside your own middleware:

```ts
// middleware.ts
import { type NextRequest } from "next/server"
import { updateSession } from "@zeno-lib/supabase/supabase-middleware"

export async function middleware(request: NextRequest) {
  // ...your logic that does not touch the Supabase response...
  return await updateSession(request)
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] }
```

> **Do not insert code between `createServerClient` and `auth.getUser()`** inside a
> forked `updateSession`, and always return the `supabaseResponse` unmodified (or
> follow the copy procedure documented in the source). Both mistakes cause users to
> be randomly logged out.

### `next/image` loader

Next's `images.loaderFile` must point at a **project-relative file with a default
export** ([Next docs](https://nextjs.org/docs/app/api-reference/components/image#loaderfile)).
`supabaseImageLoader` is a named export, so add a one-line wrapper:

```ts
// image-loader.ts (in your app)
export { supabaseImageLoader as default } from "@zeno-lib/supabase/image-loader"
```

```js
// next.config.mjs
export default {
  images: { loader: "custom", loaderFile: "./image-loader.ts" },
}
```

If the project id isn't in the environment at import time, build the loader explicitly
with `createSupabaseImageLoader({ projectId })` and default-export that instead.

`http(s)` sources pass through untouched; relative paths are rewritten to
`https://<projectId>.supabase.co/storage/v1/object/public/<src>?width=<w>&quality=<q|75>`.
A missing project-id env var throws at request time (the image breaks; the build does not fail).

## Redirect defaults

The middleware **defaults** to redirecting unauthenticated users to `/sign-in` and
treating `/sign-in` and `/auth` as public — matching
[`@zeno-lib/authentication`](https://www.npmjs.com/package/@zeno-lib/authentication)'s
`/sign-in` UI, so the two work together with no configuration.

Since only `/sign-in` and `/auth` are public by default, pass `signInPath` / `publicPaths`
to `createMiddleware` / `updateSession` (see [Middleware](#middleware)) when your routes
differ — e.g. add `/sign-up` and `/recover-password` so those flows stay reachable. (`signInPath`
must itself be in `publicPaths`, or unauthenticated users hit a redirect loop.)

## Docs

See [Supabase](https://www.zeno-lib.com/docs/core-framework/data-management/supabase).
