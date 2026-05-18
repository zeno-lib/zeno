# `@zeno-lib/authentication` — Intent

Pre-built auth UI on top of `@zeno-lib/supabase` and `@zeno-lib/ui`. Inherits root conventions; this file documents the flows and the invariants you cannot infer from reading any single file.

## Purpose & Scope

Drop-in client components for the standard Supabase auth flows: magic-link sign-in, password sign-in, sign-up, email verification, password recovery + reset, sign-out, and the OTP confirm route handler.

**Owns:** the form UI, `AuthFormContext`/`AuthProvider`, the per-flow submit handlers (Supabase client calls), toast-based error surfacing, and the server-side OTP confirm endpoint.

**Does NOT own:** the page routes themselves (the consuming app must mount each component at the matching path), the Supabase client construction (it accepts one as a prop), session/middleware redirect logic (that lives in `@zeno-lib/supabase/next-middleware`), the layout shell (the app provides it).

## Entry Points & Contracts

Exports (`package.json`):

| Import | Component |
|---|---|
| `@zeno-lib/authentication/sign-in` | `SignIn` — magic-link & password modes, mode toggle |
| `@zeno-lib/authentication/sign-up` | `SignUp` form |
| `@zeno-lib/authentication/email-sent` | `EmailSent` confirmation page |
| `@zeno-lib/authentication/verify` | `Verify` — manual click before redirect (see Pitfalls) |
| `@zeno-lib/authentication/error` | `Error` display page |
| `@zeno-lib/authentication/recover-password` | `RecoverPassword` request form |
| `@zeno-lib/authentication/reset-password` | `ResetPassword` form |
| `@zeno-lib/authentication/sign-out` | `SignOut` page |
| `@zeno-lib/authentication/layout` | Auth layout wrapper |
| `@zeno-lib/authentication/components/context` | `AuthProvider`, `useAuthForm` |
| `@zeno-lib/authentication/confirm/*` | Server-side OTP verify route handler |

Note the dual export shape: `./*` resolves `.tsx` for client components, `./confirm/*` resolves `.ts` for the server-side handler — keep that split intact when adding new files.

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

`AuthView` is one of: `"sign-in-magic-link" | "sign-in-password" | "sign-up" | "verify" | "recover-password" | "reset-password" | "sign-out"`. The submit dispatcher in `AuthProvider` uses a `switch` on view — adding a new view means adding a `case` (not extending a registry).

`AuthProvider` props:
- `supabase: SupabaseClient` — required, pass a client created by `@zeno-lib/supabase/client`
- `appBaseUrl?: string` — fallback for `redirectTo`; otherwise read from `globalThis.location.origin` or `NEXT_PUBLIC_SITE_URL`

Errors surface via `toast.error` from `@zeno-lib/ui/sonner`; the host app must render `<Toaster />` for users to see them.

## Usage Patterns

Mount the provider once near the route group root, then render the matching component on each route:

```tsx
// app/(auth)/layout.tsx
"use client"
import { AuthProvider } from "@zeno-lib/authentication/components/context"
import { createClient } from "@zeno-lib/supabase/client"

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
- **Do not throw raw errors from submit handlers.** Surface user-facing failures via `toast.error(message)`; only re-throw after notifying so upstream telemetry can capture them — this is the pattern in `AuthProvider`'s `handleSubmit` `try/catch`.
- **Do not import `@supabase/supabase-js` directly.** Take the `SupabaseClient` type from `@zeno-lib/supabase/client` so the dep edge stays clean.
- **Sign-up submission is intentionally not wired** in `AuthProvider`'s switch (see commented block at the bottom of `context.tsx`). If you implement it, follow the magic-link router-push pattern (`router.push("/email-sent")`).

## Dependencies & Edges

Workspace: `@zeno-lib/ui`, `@zeno-lib/supabase`. Peer: `next >=16`, `react >=19`, `react-dom >=19`, `react-hook-form >=7`.

Cross-package contract: the auth package issues `router.push("/email-sent")` after magic-link submit, and `Verify` redirects to `/confirm?token_hash=...&type=...`. The consuming app **must** mount routes at exactly those paths or wire its own equivalents — there is no central route map.

Cross-package gap to be aware of: `@zeno-lib/supabase/supabase-middleware` redirects unauthenticated users to **`/login`**, while this package uses **`/sign-in`**. If you adopt both as-is, override the middleware redirect in your app or you will get redirect loops. See `packages/supabase/AGENTS.md` → Pitfalls.

## Pitfalls

- **Email-prefetching guard (the most important thing in this package).** Some email providers — notably Microsoft Defender for Office 365 "Safe Links" — scan inbound URLs by fetching them, which consumes the OTP before the user clicks. `email-sent/` and `verify/` deliberately gate the redirect behind a manual button click to defeat this. The full rationale is in the docstring at `src/verify/index.tsx:1-12`. Any change that auto-completes verification *will* break magic links in the wild and the breakage will be silent in dev.
- **`shouldCreateUser: false` on magic-link sign-in** (`context.tsx:115`) — sign-in flow refuses to create an account; that's why the package has a separate sign-up component. Don't "simplify" by allowing creation here.
- **`getBaseUrl()` falls back to `http://localhost:3000`** if neither `globalThis.location.origin` nor `NEXT_PUBLIC_SITE_URL` is set. In a Server Component context with no env var, redirects will silently target localhost. Set `NEXT_PUBLIC_SITE_URL` in production or pass `appBaseUrl` explicitly to `AuthProvider`.
- **`confirm/index.ts` uses `redirect()` from `next/navigation`**, which throws — do not wrap it in `try/catch` that swallows the redirect signal.
- **`defaultNexts` in `confirm/index.ts`** routes `signup` to `/reset-password` (because Supabase's signup confirm flow uses the same OTP machinery as recovery). Surprising at first read, but intentional.
