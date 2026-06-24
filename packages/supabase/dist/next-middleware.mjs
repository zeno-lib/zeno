import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
//#region src/next-middleware.ts
/**
* Refreshes the auth session and gates unauthenticated requests.
* Call it from your own `middleware.ts`, or use `createMiddleware`/`middleware` below.
*/
async function updateSession(request, options) {
	let supabaseResponse = NextResponse.next({ request });
	const supabaseUrl = options?.supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseKey = options?.supabaseKey ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
	const signInPath = options?.signInPath ?? "/sign-in";
	const publicPaths = options?.publicPaths ?? ["/sign-in"];
	if (!(supabaseUrl && supabaseKey)) throw new Error("Missing Supabase update session environment variables");
	const { data: { user } } = await createServerClient(supabaseUrl, supabaseKey, { cookies: {
		getAll() {
			return request.cookies.getAll();
		},
		setAll(cookiesToSet) {
			for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
			supabaseResponse = NextResponse.next({ request });
			for (const { name, options: cookieOptions, value } of cookiesToSet) supabaseResponse.cookies.set(name, value, cookieOptions);
		}
	} }).auth.getUser();
	const isPublicPath = publicPaths.some((path) => request.nextUrl.pathname.startsWith(path));
	if (!(user || isPublicPath)) {
		const url = request.nextUrl.clone();
		url.pathname = signInPath;
		return NextResponse.redirect(url);
	}
	return supabaseResponse;
}
/**
* Build a middleware bound to your auth config. Next requires `config.matcher`
* to be statically analyzable, so always export a static `config` alongside it —
* re-export the default one below or declare your own:
*
* ```ts
* // middleware.ts
* import { createMiddleware, config } from "@zeno-lib/supabase/next-middleware"
*
* export const middleware = createMiddleware({ signInPath: "/sign-in" })
* export { config }
* ```
*/
function createMiddleware(options) {
	return (request) => updateSession(request, options);
}
/** Zero-config middleware using the default `/sign-in` redirect. */
async function middleware(request) {
	return await updateSession(request);
}
const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
//#endregion
export { config, createMiddleware, middleware, updateSession };
