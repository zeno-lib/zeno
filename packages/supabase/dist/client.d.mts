import { createClient as createClient$1 } from "@supabase/supabase-js";

//#region src/client.d.ts
/**
 * Plain `@supabase/supabase-js` client.
 * Use it for server-side data access that doesn't need the user's session.
 * For authenticated SSR use the `next-client`/`next-server` factories.
 */
declare function createClient<Database>(/** Supabase project URL. Defaults to `SUPABASE_URL`, then `NEXT_PUBLIC_SUPABASE_URL`. */

supabaseUrl?: string, /** Supabase key. Defaults to `SUPABASE_SECRET_KEY`, then `SUPABASE_PUBLISHABLE_KEY`, then `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */

supabaseKey?: string, /** Options forwarded to the client; `auth.persistSession` defaults to `false`. */

options?: Parameters<typeof createClient$1>[2]): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends keyof Database ? keyof Database & "public" : string & keyof Database, Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] extends import("@supabase/supabase-js/dist/module/lib/types").GenericSchema ? Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] : any>;
//#endregion
export { createClient };