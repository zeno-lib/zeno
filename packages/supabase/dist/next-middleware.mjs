import { updateSession } from "./supabase-middleware.mjs";
//#region src/next-middleware.ts
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
export { config, createMiddleware, middleware };
