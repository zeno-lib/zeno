import { createBrowserClient } from "@supabase/ssr";
//#region src/next-client.ts
/**
* Browser Supabase client backed by the cookie session (`@supabase/ssr`).
* Use it in Client Components and other browser-side code.
* For Server Components and Route Handlers use the `next-server` factory.
*/
function createClient(supabaseUrl, supabaseKey, options) {
	const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!(url && key)) throw new Error("Missing Supabase client environment variables");
	return createBrowserClient(url, key, options);
}
//#endregion
export { createClient };
