# `@zeno-lib/authentication`: Intent

Pre-built auth UI on top of `@zeno-lib/supabase` and shadcn primitives. Inherits root conventions; this file documents the flows and the invariants you cannot infer from reading any single file.

**Distribution split.** The UI flows are UI-coupled, so they ship via the shadcn **registry**
(`shadcn add zeno-lib/zeno/sign-in`, `/sign-up`, `/verify`, …) and drop into the user's repo under
`@/components/auth/*`, pulling the shadcn primitives they need (bare `registryDependencies`) and
importing `@zeno-lib/supabase` as an npm dep. Only the **server-side `confirm` handler** (no UI)
stays on npm; the package `exports` are narrowed to `./confirm/*`, and `files` ships only
`src/confirm`. The registry blocks are served **verbatim** from `src/**` (each file's imports are
already in the consumer dialect: `@/components/ui/*`, `@/lib/utils`, `sonner`); `pnpm registry:build`
only regenerates the `registry.json` manifest, never file copies.

## Purpose & Scope

Drop-in client components for the standard Supabase auth flows: magic-link sign-in, password sign-in, sign-up, email verification, password recovery + reset, sign-out, and the (npm) OTP confirm route handler.

**Owns:** the form UI, `AuthFormContext`/`AuthProvider`, the per-flow submit handlers (Supabase client calls), toast-based error surfacing, and the server-side OTP confirm endpoint.

**Does NOT own:** the page routes themselves (the consuming app must mount each component at the matching path), the Supabase client construction (it accepts one as a prop), session/middleware redirect logic (that lives in `@zeno-lib/supabase/next-middleware`), the layout shell (the app provides it).

## Entry Points & Contracts

**npm** exports (`package.json`), server only:

| Import | Component |
|---|---|
| `@zeno-lib/authentication/confirm/*` | Server-side OTP verify route handler |

**Registry** blocks (`shadcn add zeno-lib/zeno/<name>`); each drops into `@/components/auth/*`:

| Item | Component |
|---|---|
| `sign-in` | `SignIn`, magic-link & password modes, mode toggle |
| `sign-up` | `SignUp` form |
| `email-sent` | `EmailSent` confirmation page |
| `verify` | `Verify`, manual click before redirect (see Pitfalls) |
| `error` | `Error` display page (also imports `@zeno-lib/supabase`) |
| `recover-password` | `RecoverPassword` request form |
| `reset-password` | `ResetPassword` form |
| `sign-out` | `SignOut` page |
| `auth-layout` | Auth layout wrapper + `AuthProvider` |

Each block is self-contained: the generator follows relative imports to bundle the shared
`components/*` (context, container, inputs, …) alongside the flow; intra-imports stay relative
so they resolve once dropped in. The source imports `toast` from `sonner` directly (npm) since
shadcn's sonner exports only `Toaster`.

`AuthFormContext` (`src/components/context.tsx`):

```ts
interface AuthState {
  email: string
  password: string
  loading: boolean
  setEmail: Dispatch<SetStateAction<string>>
  setPassword: Dispatch<SetStateAction<string>>
  handleSubmit: (view: AuthView) => (event: FormEvent) => Promise<void>
}
```

`AuthView` is one of: `"sign-in-magic-link" | "sign-in-password" | "sign-up" | "verify" | "recover-password" | "reset-password" | "sign-out"`. The submit dispatcher in `AuthProvider` uses a `switch` on view; adding a new view means adding a `case` (not extending a registry).

`AuthProvider` props:
- `supabase: SupabaseClient`: required, pass a client created by `@zeno-lib/supabase/next-client`
- `appBaseUrl?: string`: fallback for `redirectTo`; otherwise read from `globalThis.location.origin` or `NEXT_PUBLIC_SITE_URL`

Errors surface via `toast.error` from `sonner`; the host app must render `<Toaster />` for users to see them.

## Usage Patterns

Mount the provider once near the route group root, then render the matching component on each route:

```tsx
// app/(auth)/layout.tsx
"use client"
import { AuthProvider } from "@zeno-lib/authentication/components/context"
import { createClient } from "@zeno-lib/supabase/next-client"

export default function AuthLayout({ children }) {
  const supabase = createClient()
  return <AuthProvider supabase={supabase}>{children}</AuthProvider>
}
```

```tsx
// app/(auth)/sign-in/page.tsx
import { SignIn } from "@zeno-lib/authentication/sign-in"
export default function Page() { return <SignIn /> }
```

OTP confirm route (server):

```ts
// app/confirm/route.ts
import { getRoute } from "@zeno-lib/authentication/confirm/index"
export const GET = getRoute
```

## Anti-patterns

- **Do not auto-redirect from `verify/`.** The button-click is a *security* feature, not a UX placeholder (see Pitfalls). The commented-out `useEffect` in `verify/index.tsx` exists as a cautionary tombstone; do not uncomment it.
- **Do not perform OTP verification client-side.** `supabase.auth.verifyOtp` is called from the server handler in `src/confirm/index.ts`. Calling it from a client component leaks the token through the browser history and breaks magic-link flows behind email-prefetch scanners.
- **Do not throw raw errors from submit handlers.** Surface user-facing failures via `toast.error(message)`; only re-throw after notifying so upstream telemetry can capture them. This is the pattern in `AuthProvider`'s `handleSubmit` `try/catch`.
- **Sign-up submission is intentionally not wired** in `AuthProvider`'s switch (see commented block at the bottom of `context.tsx`). If you implement it, follow the magic-link router-push pattern (`router.push("/email-sent")`).

## Dependencies & Edges

npm dependency: `@zeno-lib/supabase` (used by the `confirm` handler and the `error` block). `@zeno-lib/ui` (the `@/components/ui/*` / `@/lib/utils` alias target, via tsconfig `paths`) and `sonner` (the flows import `toast` from it) are **devDependencies**: only the registry-source flows need them for in-workspace typecheck, and the published npm surface (`confirm`) is UI-free. Peers: `@supabase/supabase-js >=2`, `next >=16`, `react >=19`, `react-dom >=19`.

Cross-package contract: the auth package issues `router.push("/email-sent")` after magic-link submit, and `Verify` redirects to `/confirm?token_hash=...&type=...`. The consuming app **must** mount routes at exactly those paths or wire its own equivalents. There is no central route map.

Cross-package alignment: `@zeno-lib/supabase/next-middleware` defaults to redirecting unauthenticated users to `/sign-in`, matching this package's `/sign-in` UI, so the two pair with no extra configuration. See the Pitfalls section of `packages/supabase/AGENTS.md` for the redirect invariants.

## Pitfalls

- **Email-prefetching guard (the most important thing in this package).** Some email providers (notably Microsoft Defender for Office 365 "Safe Links") scan inbound URLs by fetching them, which consumes the OTP before the user clicks. `email-sent/` and `verify/` deliberately gate the redirect behind a manual button click to defeat this. The full rationale is in the docstring at `src/verify/index.tsx:1-12`. Any change that auto-completes verification *will* break magic links in the wild and the breakage will be silent in dev.
- **`shouldCreateUser: false` on magic-link sign-in** (`context.tsx:115`): sign-in flow refuses to create an account; that's why the package has a separate sign-up component. Don't "simplify" by allowing creation here.
- **`getBaseUrl()` falls back to `http://localhost:3000`** if neither `globalThis.location.origin` nor `NEXT_PUBLIC_SITE_URL` is set. In a Server Component context with no env var, redirects will silently target localhost. Set `NEXT_PUBLIC_SITE_URL` in production or pass `appBaseUrl` explicitly to `AuthProvider`.
- **`confirm/index.ts` uses `redirect()` from `next/navigation`**, which throws, so do not wrap it in `try/catch` that swallows the redirect signal.
- **`defaultNexts` in `confirm/index.ts`** routes `signup` to `/reset-password` (because Supabase's signup confirm flow uses the same OTP machinery as recovery). Surprising at first read, but intentional.
