// https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"
import { requireSupabaseEnv } from "./env"

export type UpdateSessionOptions = {
  /** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */
  supabaseUrl?: string
  /** Supabase key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
  supabaseKey?: string
  /** Where to redirect unauthenticated requests. Defaults to `/sign-in`. */
  signInPath?: string
  /** Path prefixes that skip the auth check. Defaults to `["/sign-in"]`. */
  publicPaths?: string[]
}

/**
 * Refreshes the auth session and gates unauthenticated requests.
 * Call it from your own `middleware.ts`, or use `createMiddleware`/`middleware` below.
 */
export async function updateSession(
  request: NextRequest,
  options?: UpdateSessionOptions
) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  const { url: supabaseUrl, key: supabaseKey } = requireSupabaseEnv(
    options?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    options?.supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
  const signInPath = options?.signInPath ?? "/sign-in"
  const publicPaths = options?.publicPaths ?? ["/sign-in"]

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        supabaseResponse = NextResponse.next({
          request,
        })
        for (const { name, options: cookieOptions, value } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, cookieOptions)
        }
      },
    },
  })
  // Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.
  // IMPORTANT: DO NOT REMOVE auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isPublicPath = publicPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  )
  if (!(user || isPublicPath)) {
    // no user, potentially respond by redirecting the user to the sign-in page
    const url = request.nextUrl.clone()
    url.pathname = signInPath
    return NextResponse.redirect(url)
  }
  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!
  return supabaseResponse
}

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
