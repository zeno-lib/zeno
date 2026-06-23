import { createBrowserClient } from "@supabase/ssr";

//#region src/next-client.d.ts
/**
 * Browser Supabase client backed by the cookie session (`@supabase/ssr`).
 * Use it in Client Components and other browser-side code.
 * For Server Components and Route Handlers use the `next-server` factory.
 */
declare function createClient<Database>(/** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */

supabaseUrl?: string, /** Supabase publishable key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */

supabaseKey?: string, /** Options forwarded to `createBrowserClient`. */

options?: Parameters<typeof createBrowserClient>[2]): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends keyof Database ? keyof Database & "public" : string & keyof Database, Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] extends import("@supabase/supabase-js/dist/module/lib/types").GenericSchema ? Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] : any>;
//#endregion
export { createClient };