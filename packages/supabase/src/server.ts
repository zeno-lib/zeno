// https://supabase.com/docs/guides/auth/server-side/nextjs
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient<Database>(
  supabaseUrl?: string,
  supabaseKey?: string
) {
  const cookieStore = await cookies()

  const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  // Prefer the new publishable key; fall back to the legacy anon key.
  const key =
    supabaseKey ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!(url && key)) {
    throw new Error("Missing Supabase environment variables")
  }

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, options, value } of cookiesToSet) {
            cookieStore.set(name, value, options)
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
