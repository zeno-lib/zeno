import { EmailOtpType, QueryData, SupabaseClient } from "@supabase/supabase-js";

//#region src/client.d.ts
declare function createClient<Database>(supabaseUrl?: string, supabaseKey?: string): import("@supabase/supabase-js").SupabaseClient<Database, "public" extends keyof Database ? keyof Database & "public" : string & keyof Database, Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] extends import("@supabase/supabase-js/dist/module/lib/types").GenericSchema ? Database["public" extends keyof Database ? keyof Database & "public" : string & keyof Database] : any>;
//#endregion
export { type EmailOtpType, type QueryData, type SupabaseClient, createClient };