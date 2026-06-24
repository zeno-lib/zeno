import { NextRequest, NextResponse } from "next/server";

//#region src/next-middleware.d.ts
type UpdateSessionOptions = {
  /** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */supabaseUrl?: string; /** Supabase key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
  supabaseKey?: string; /** Where to redirect unauthenticated requests. Defaults to `/sign-in`. */
  signInPath?: string; /** Path prefixes that skip the auth check. Defaults to `["/sign-in"]`. */
  publicPaths?: string[];
};
/**
 * Refreshes the auth session and gates unauthenticated requests.
 * Call it from your own `middleware.ts`, or use `createMiddleware`/`middleware` below.
 */
declare function updateSession(request: NextRequest, options?: UpdateSessionOptions): Promise<NextResponse<unknown>>;
/**
 * Build a middleware bound to your auth config. Next requires `config.matcher`
 * to be statically analyzable, so always export a static `config` alongside it —
 * re-export the default one below or declare your own:
 *
 * ```ts
 * // middleware.ts
 * import { createMiddleware, config } from "@zeno-lib/supabase/next-middleware"
 *
 * export const middleware = createMiddleware({ signInPath: "/sign-in" })
 * export { config }
 * ```
 */
declare function createMiddleware(options?: UpdateSessionOptions): (request: NextRequest) => Promise<NextResponse<unknown>>;
/** Zero-config middleware using the default `/sign-in` redirect. */
declare function middleware(request: NextRequest): Promise<NextResponse<unknown>>;
declare const config: {
  matcher: string[];
};
//#endregion
export { UpdateSessionOptions, config, createMiddleware, middleware, updateSession };