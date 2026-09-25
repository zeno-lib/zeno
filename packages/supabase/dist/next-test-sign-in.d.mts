//#region src/next-test-sign-in.d.ts
interface TestSignInRouteOptions {
  /**
   * The gate, evaluated on **every** request, never at import. Return `true`
   * only in development and test environments; when it returns `false` the
   * route answers `404` as if it did not exist. Required: there is no default,
   * so the route cannot ship ungated by omission.
   */
  isEnabled: () => boolean;
  /** Supabase publishable key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, like `next-server`. */
  supabaseKey?: string;
  /** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`, like `next-server`. */
  supabaseUrl?: string;
}
/**
 * **Test-only.** A Next.js Route Handler that signs a user in with email and
 * password through the cookie-backed server client, for Playwright to skip the
 * sign-in UI (pair it with `signInViaApi` from `@zeno-lib/e2e/auth`).
 *
 * It answers `{ session, storageKey }`, where `storageKey` is the SSR cookie
 * and `BroadcastChannel` name, so the test side need not hard-code it. The
 * server client also sets the auth cookies on the response.
 *
 * ```ts
 * // app/api/test/sign-in/route.ts
 * export const POST = createTestSignInRoute({
 *   isEnabled: () => ["development", "test"].includes(process.env.NEXT_PUBLIC_ENVIRONMENT ?? ""),
 * })
 * ```
 */
declare function createTestSignInRoute({ isEnabled, supabaseKey, supabaseUrl }: TestSignInRouteOptions): (request: Request) => Promise<Response>;
//#endregion
export { TestSignInRouteOptions, createTestSignInRoute };