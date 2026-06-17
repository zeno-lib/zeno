import { UpdateSessionOptions } from "./supabase-middleware.mjs";
import { NextRequest } from "next/server";

//#region src/next-middleware.d.ts
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
declare function createMiddleware(options?: UpdateSessionOptions): (request: NextRequest) => Promise<import("next/server").NextResponse<unknown>>;
/** Zero-config middleware using the default `/sign-in` redirect. */
declare function middleware(request: NextRequest): Promise<import("next/server").NextResponse<unknown>>;
declare const config: {
  matcher: string[];
};
//#endregion
export { config, createMiddleware, middleware };