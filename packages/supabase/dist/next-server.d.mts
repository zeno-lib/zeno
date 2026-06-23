import { createServerClient } from "@supabase/ssr";

//#region src/next-server.d.ts
/**
 * Server Supabase client backed by the cookie session (`@supabase/ssr`); async — `await` it.
 * Use it in Server Components, Route Handlers, and Server Actions.
 * For Client Components use the `next-client` factory.
 */
declare function createClient<Database>(/** Supabase project URL. Defaults to `NEXT_PUBLIC_SUPABASE_URL`. */

supabaseUrl?: string, /** Supabase publishable key. Defaults to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. */

supabaseKey?: string, /** Options forwarded to `createServerClient`; cookie wiring defaults to `next/headers`. */

options?: Partial<Parameters<typeof createServerClient>[2]>): Promise<import("@supabase/supabase-js").SupabaseClient<Database, "public" extends keyof Database ? keyof Database & "public" : string & keyof Database, Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] extends import("@supabase/supabase-js/dist/module/lib/types").GenericSchema ? Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] : any>>;
//#endregion
export { createClient };