// https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

export type UpdateSessionOptions = {
  /** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */
  supabaseUrl?: string
  /** Supabase anon key. Defaults to `NEXT_PUBLIC_SUPABASE_ANON_KEY`. */
  supabaseKey?: string
  /** Where to redirect unauthenticated requests. Defaults to `/sign-in`. */
  signInPath?: string
  /** Path prefixes that skip the auth check. Defaults to `["/sign-in", "/auth"]`. */
  publicPaths?: string[]
}

export async function updateSession(
  request: NextRequest,
  options?: UpdateSessionOptions
) {
  let supabaseResponse = NextResponse.next({
    request,
  })
  const supabaseUrl =
    options?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey =
    options?.supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const signInPath = options?.signInPath ?? "/sign-in"
  const publicPaths = options?.publicPaths ?? ["/sign-in", "/auth"]

  if (!(supabaseUrl && supabaseKey)) {
    throw new Error("Missing Supabase update session environment variables")
  }
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
