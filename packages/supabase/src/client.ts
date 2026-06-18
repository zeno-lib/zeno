// https://supabase.com/docs/guides/auth/server-side/nextjs
import { createBrowserClient } from "@supabase/ssr"

export function createClient<Database>(
  supabaseUrl?: string,
  supabaseKey?: string
) {
  const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!(url && key)) {
    throw new Error("Missing Supabase client environment variables")
  }

  return createBrowserClient<Database>(url, key)
}
