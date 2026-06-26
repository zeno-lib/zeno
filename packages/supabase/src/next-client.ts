// https://supabase.com/docs/guides/auth/server-side/nextjs
import { createBrowserClient } from "@supabase/ssr"
import { requireSupabaseEnv } from "./env"

/**
 * Browser Supabase client backed by the cookie session (`@supabase/ssr`).
 * Use it in Client Components and other browser-side code.
 * For Server Components and Route Handlers use the `next-server` factory.
 */
export function createClient<Database>(
  /** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */
  supabaseUrl?: string,
  /** Supabase publishable key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
  supabaseKey?: string,
  /** Options forwarded to `createBrowserClient`. */
  options?: Parameters<typeof createBrowserClient>[2]
) {
  const { url, key } = requireSupabaseEnv(
    supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )

  return createBrowserClient<Database>(url, key, options)
}
