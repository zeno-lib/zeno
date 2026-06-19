import { createClient as createSupabaseClient } from "@supabase/supabase-js"

/**
 * Plain `@supabase/supabase-js` client.
 * Use it for server-side data access that doesn't need the user's session.
 * For authenticated SSR use the `next-client`/`next-server` factories.
 */
export function createClient<Database>(
  /** Supabase project URL. Defaults to `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */
  supabaseUrl?: string,
  /** Supabase key. Defaults to `SUPABASE_SECRET_KEY`, then `SUPABASE_PUBLISHABLE_KEY`, then `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
  supabaseKey?: string,
  /** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
  options?: Parameters<typeof createSupabaseClient>[2]
) {
  const url =
    supabaseUrl ??
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    supabaseKey ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!(url && key)) {
    throw new Error("Missing Supabase client environment variables")
  }

  return createSupabaseClient<Database>(url, key, {
    ...options,
    auth: { persistSession: false, ...options?.auth },
  })
}
