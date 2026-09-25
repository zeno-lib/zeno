import { createClient } from "./next-server.mjs";
//#region src/next-test-sign-in.ts
const json = (body, status) => Response.json(body, {
	headers: { "Cache-Control": "private, no-store" },
	status
});
/** The same `sb-<first hostname label>-auth-token` key `supabase-js` derives. */
const storageKeyFor = (supabaseUrl) => supabaseUrl ? `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token` : void 0;
const readCredentials = async (request) => {
	try {
		const body = await request.json();
		if (typeof body !== "object" || body === null) return;
		const { email, password } = body;
		return typeof email === "string" && email !== "" && typeof password === "string" && password !== "" ? {
			email,
			password
		} : void 0;
	} catch {
		return;
	}
};
/**
* **Test-only.** A Next.js Route Handler that signs a user in with email and
* password through the cookie-backed server client, for Playwright to skip the
* sign-in UI (pair it with `signInViaApi` from `@zeno-lib/e2e/auth`).
*
* It answers `{ session, storageKey }`, where `storageKey` is the SSR cookie
* and `BroadcastChannel` name, so the test side need not hard-code it. The
* server client also sets the auth cookies on the response.
*
* ```ts
* // app/api/test/sign-in/route.ts
* export const POST = createTestSignInRoute({
*   isEnabled: () => ["development", "test"].includes(process.env.NEXT_PUBLIC_ENVIRONMENT ?? ""),
* })
* ```
*/
function createTestSignInRoute({ isEnabled, supabaseKey, supabaseUrl }) {
	return async (request) => {
		if (!isEnabled()) return json({ error: "Not found" }, 404);
		const credentials = await readCredentials(request);
		if (!credentials) return json({ error: "Email and password are required" }, 400);
		try {
			const url = supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
			const { data, error } = await (await createClient(url, supabaseKey)).auth.signInWithPassword(credentials);
			if (error || !data.session) return json({ error: error?.message ?? "Invalid credentials" }, 401);
			return json({
				session: data.session,
				storageKey: storageKeyFor(url)
			}, 200);
		} catch (error) {
			return json({ error: `Unexpected error: ${error instanceof Error ? error.message : String(error)}` }, 500);
		}
	};
}
//#endregion
export { createTestSignInRoute };
