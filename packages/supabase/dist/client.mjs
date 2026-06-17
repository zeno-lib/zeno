import { createBrowserClient } from "@supabase/ssr";
//#region src/client.ts
function createClient(supabaseUrl, supabaseKey) {
	const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!(url && key)) throw new Error("Missing Supabase client environment variables");
	return createBrowserClient(url, key);
}
//#endregion
export { createClient };
