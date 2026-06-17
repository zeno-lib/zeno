import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
//#region src/server.ts
async function createClient(supabaseUrl, supabaseKey) {
	const cookieStore = await cookies();
	const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!(url && key)) throw new Error("Missing Supabase environment variables");
	return createServerClient(url, key, { cookies: {
		getAll() {
			return cookieStore.getAll();
		},
		setAll(cookiesToSet) {
			try {
				for (const { name, options, value } of cookiesToSet) cookieStore.set(name, value, options);
			} catch {}
		}
	} });
}
//#endregion
export { createClient };
