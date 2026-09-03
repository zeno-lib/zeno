import { createClient as createClient$1 } from "@supabase/supabase-js";
//#region src/client.d.ts
/**
 * Plain `@supabase/supabase-js` client with no cookie/session wiring.
 * Use it for backend, API, or script contexts that don't need the user's session.
 * Takes the URL and key explicitly; use `createAnonClient` / `createAdminClient` for environment-based defaults.
 */
declare function createClient<Database>(
/** Supabase project URL. */
supabaseUrl: string,
/** Supabase API key. */
supabaseKey: string,
/** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
options?: Parameters<typeof createClient$1>[2]): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends keyof Database ? keyof Database & "public" : string & keyof Database, Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] extends import("@supabase/supabase-js/dist/module/lib/types").GenericSchema ? Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] : any>;
/**
 * Plain client using the publishable (anon) key by default, so it honors Row Level Security.
 * Use it for untrusted or client-safe data access.
 * For service-role access use the `createAdminClient` factory.
 */
declare function createAnonClient<Database>(
/** Supabase project URL. Defaults to `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */
supabaseUrl?: string,
/** Supabase publishable key. Defaults to `SUPABASE_PUBLISHABLE_KEY`, then `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */
supabaseKey?: string,
/** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
options?: Parameters<typeof createClient$1>[2]): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends keyof Database ? keyof Database & "public" : string & keyof Database, Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] extends import("@supabase/supabase-js/dist/module/lib/types").GenericSchema ? Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] : any>;
/**
 * Plain client using the secret (service-role) key by default, so it bypasses Row Level Security.
 * Use it server-side only; it can read or write any row.
 * For RLS-scoped access use the `createAnonClient` factory.
 */
declare function createAdminClient<Database>(
/** Supabase project URL. Defaults to `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */
supabaseUrl?: string,
/** Supabase secret key. Defaults to `SUPABASE_SECRET_KEY`. */
supabaseKey?: string,
/** Options forwarded to the client; `auth.persistSession` defaults to `false`. */
options?: Parameters<typeof createClient$1>[2]): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends keyof Database ? keyof Database & "public" : string & keyof Database, Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] extends import("@supabase/supabase-js/dist/module/lib/types").GenericSchema ? Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] : any>;
//#endregion
export { createAdminClient, createAnonClient, createClient };