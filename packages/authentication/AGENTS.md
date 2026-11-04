# `@zeno-lib/authentication`

Supabase auth flows, plus the consent and connected-apps screens of Supabase Auth's OAuth server.
The UI flows ship through the shadcn registry (`shadcn add zeno-lib/zeno/sign-in`, …) and drop into
`@/components/auth/*`; only the server-side `confirm` handler is on npm, so `exports` and `files`
cover `src/confirm` alone. The user guide is in
[`user-management/authentication`](../../apps/docs/content/docs/core-framework/user-management/authentication.mdx).

## The email-prefetch guard

**This is the most important thing in the package.** Some mail scanners (such as Microsoft
Defender's Safe Links) fetch inbound URLs, which consumes the OTP before the user clicks.
`email-sent/` and `verify/` gate the redirect behind a manual button click to defeat this; the
rationale is in the docstring at the top of `src/verify/index.tsx`.

- **Never auto-redirect from `verify/`.** The commented-out `useEffect` there is a tombstone; leave
  it commented. Any change that auto-completes verification breaks magic links in the wild, and
  silently in dev.
- **Never call `verifyOtp` client-side.** It runs in `src/confirm/index.ts`; from a client component
  it leaks the token into browser history and breaks behind prefetch scanners.

## Rules

- **Registry sources ship verbatim.** Keep their imports in the consumer dialect (`@/components/ui/*`,
  `@/lib/utils`), keep intra-package imports relative so the generator bundles them, and import
  `toast` from `sonner` directly, because shadcn's sonner exports only `Toaster`.
- **Magic-link sign-in keeps `shouldCreateUser: false`.** Sign-up is a separate component; don't let
  sign-in create accounts.
- **Surface failures with `toast.error`**, and only re-throw after notifying. The host app must render
  `<Toaster />`.
- **The flows push to `/email-sent` and `/confirm?token_hash=…&type=…`.** There is no route map, so
  consuming apps mount exactly those paths.
- **Every `next` goes through `safeNextPath` (`src/confirm/safe-next-path.ts`)**: the sign-in flows
  and `confirm` alike. An unchecked `next` makes a signed-in link an open redirect. It lives under
  `src/confirm/` because only that folder ships on npm.
- **`oauth-clients/access.ts` refuses everyone by default.** Its actions use the secret key, and each
  is a public endpoint, so the shipped `canManageOAuthClients` stays `false` until the app fills it in.
- **The OAuth admin actions return their failures** (`{ ok: false, error }`): Next redacts a thrown
  server action error in production, and Auth's message is the one the admin needs.
- **A new `AuthView` needs a `case` in `AuthProvider`'s submit `switch`.** Sign-up submission is
  deliberately not wired there (see the comment at the bottom of `context.tsx`).

## Traps

- **`confirm/index.ts` calls `redirect()`, which throws.** Never wrap it in a `try/catch` that
  swallows the signal.
- **`defaultNexts` routes `signup` to `/reset-password` on purpose**, because Supabase's signup
  confirm uses the same OTP machinery as recovery.
- **`getBaseUrl()` falls back to `http://localhost:3000`** without `globalThis.location.origin` or
  `NEXT_PUBLIC_SITE_URL`, so a server-side redirect can silently target localhost.
