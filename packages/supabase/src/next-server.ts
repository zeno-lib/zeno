// https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Server Supabase client backed by the cookie session (`@supabase/ssr`); async — `await` it.
 * Use it in Server Components, Route Handlers, and Server Actions.
 * For Client Components use the `next-client` factory.
 */
export async function createClient<Database>(
  /** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */
  supabaseUrl?: string,
  /** Supabase publishable key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
  supabaseKey?: string,
  /** Options forwarded to `createServerClient`; cookie wiring defaults to `next/headers`. */
  options?: Partial<Parameters<typeof createServerClient>[2]>
) {
  const cookieStore = await cookies()

  const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!(url && key)) {
    throw new Error("Missing Supabase environment variables")
  }

  return createServerClient<Database>(url, key, {
    ...options,
    cookies: options?.cookies ?? {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options: cookieOptions, value } of cookiesToSet) {
            cookieStore.set(name, value, cookieOptions)
          }
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}
