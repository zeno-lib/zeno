import { t as requireSupabaseEnv } from "./env-zicg-Mwf.mjs";
import { createClient as createClient$1 } from "@supabase/supabase-js";
//#region src/client.ts
/**
* Plain `@supabase/supabase-js` client with no cookie/session wiring.
* Use it for backend, API, or script contexts that don't need the user's session.
* Takes the URL and key explicitly; use `createAnonClient` / `createAdminClient` for environment-based defaults.
*/
function createClient(supabaseUrl, supabaseKey, options) {
	return createClient$1(supabaseUrl, supabaseKey, {
		...options,
		auth: {
			persistSession: false,
			...options?.auth
		}
	});
}
/**
* Plain client using the publishable (anon) key by default, so it honors Row Level Security.
* Use it for untrusted or client-safe data access.
* For service-role access use the `createAdminClient` factory.
*/
function createAnonClient(supabaseUrl, supabaseKey, options) {
	const { url, key } = requireSupabaseEnv(supabaseUrl ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey ?? process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
	return createClient(url, key, options);
}
/**
* Plain client using the secret (service-role) key by default, so it bypasses Row Level Security.
* Use it server-side only; it can read or write any row.
* For RLS-scoped access use the `createAnonClient` factory.
*/
function createAdminClient(supabaseUrl, supabaseKey, options) {
	const { url, key } = requireSupabaseEnv(supabaseUrl ?? process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, supabaseKey ?? process.env.SUPABASE_SECRET_KEY);
	return createClient(url, key, options);
}
//#endregion
export { createAdminClient, createAnonClient, createClient };
