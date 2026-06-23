import { createClient as createClient$1 } from "@supabase/supabase-js";
//#region src/client.ts
/**
* Plain `@supabase/supabase-js` client.
* Use it for server-side data access that doesn't need the user's session.
* For authenticated SSR use the `next-client`/`next-server` factories.
*/
function createClient(supabaseUrl, supabaseKey, options) {
	const url = supabaseUrl ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = supabaseKey ?? process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!(url && key)) throw new Error("Missing Supabase client environment variables");
	return createClient$1(url, key, {
		...options,
		auth: {
			persistSession: false,
			...options?.auth
		}
	});
}
//#endregion
export { createClient };
