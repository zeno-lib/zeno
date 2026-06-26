import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { requireSupabaseEnv } from "./env"

/**
 * Plain `@supabase/supabase-js` client with no cookie/session wiring.
 * Use it for backend, API, or script contexts that don't need the user's session.
 * Takes the URL and key explicitly; use `createAnonClient` / `createAdminClient` for environment-based defaults.
 */
export function createClient<Database>(
  /** Supabase project URL. */
  supabaseUrl: string,
  /** Supabase API key. */
  supabaseKey: string,
  /** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
  options?: Parameters<typeof createSupabaseClient>[2]
) {
  return createSupabaseClient<Database>(supabaseUrl, supabaseKey, {
    ...options,
    auth: { persistSession: false, ...options?.auth },
  })
}

/**
 * Plain client using the publishable (anon) key by default, so it honors Row Level Security.
 * Use it for untrusted or client-safe data access.
 * For service-role access use the `createAdminClient` factory.
 */
export function createAnonClient<Database>(
  /** Supabase project URL. Defaults to `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */
  supabaseUrl?: string,
  /** Supabase publishable key. Defaults to `SUPABASE_PUBLISHABLE_KEY`, then `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
  supabaseKey?: string,
  /** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
  options?: Parameters<typeof createSupabaseClient>[2]
) {
  const { url, key } = requireSupabaseEnv(
    supabaseUrl ??
      process.env.SUPABASE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey ??
      process.env.SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )

  return createClient<Database>(url, key, options)
}

/**
 * Plain client using the secret (service-role) key by default, so it bypasses Row Level Security.
 * Use it server-side only; it can read or write any row.
 * For RLS-scoped access use the `createAnonClient` factory.
 */
export function createAdminClient<Database>(
  /** Supabase project URL. Defaults to `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */
  supabaseUrl?: string,
  /** Supabase secret key. Defaults to `SUPABASE_SECRET_KEY`. */
  supabaseKey?: string,
  /** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
  options?: Parameters<typeof createSupabaseClient>[2]
) {
  const { url, key } = requireSupabaseEnv(
    supabaseUrl ??
      process.env.SUPABASE_URL ??
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseKey ?? process.env.SUPABASE_SECRET_KEY
  )

  return createClient<Database>(url, key, options)
}
