import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
//#region src/next-server.ts
/**
* Server Supabase client backed by the cookie session (`@supabase/ssr`); async — `await` it.
* Use it in Server Components, Route Handlers, and Server Actions.
* For Client Components use the `next-client` factory.
*/
async function createClient(supabaseUrl, supabaseKey, options) {
	const cookieStore = await cookies();
	const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	if (!(url && key)) throw new Error("Missing Supabase environment variables");
	return createServerClient(url, key, {
		...options,
		cookies: options?.cookies ?? {
			getAll() {
				return cookieStore.getAll();
			},
			setAll(cookiesToSet) {
				try {
					for (const { name, options: cookieOptions, value } of cookiesToSet) cookieStore.set(name, value, cookieOptions);
				} catch {}
			}
		}
	});
}
//#endregion
export { createClient };
