// https://supabase.com/docs/guides/auth/server-side/nextjs
import type { NextRequest } from "next/server"
import { type UpdateSessionOptions, updateSession } from "./supabase-middleware"

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
export function createMiddleware(options?: UpdateSessionOptions) {
  return (request: NextRequest) => updateSession(request, options)
}

/** Zero-config middleware using the default `/sign-in` redirect. */
export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
