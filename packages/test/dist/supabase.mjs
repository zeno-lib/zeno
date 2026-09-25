//#region src/supabase.ts
/** Thrown by cleanup when one or more steps still failed; `errors` holds each cause. */
var TestCleanupError = class extends Error {
	constructor(message, errors) {
		super(message);
		this.name = "TestCleanupError";
		this.errors = errors;
	}
};
const DEFAULT_PASSWORD = "zeno-test-password";
const DEFAULT_ATTEMPTS = 4;
const DEFAULT_DELAY_MS = 200;
const RETRYABLE_STATUSES = /* @__PURE__ */ new Set([
	429,
	502,
	503,
	504
]);
const errorField = (error, field) => typeof error === "object" && error !== null && field in error ? error[field] : void 0;
/**
* Whether an Auth error is transient. Matched by shape rather than with
* `isAuthRetryableFetchError`, so an error from a second copy of
* `@supabase/auth-js` still counts.
*/
const isRetryableAuthError = (error) => {
	if (errorField(error, "name") === "AuthRetryableFetchError") return true;
	const status = errorField(error, "status");
	return typeof status === "number" && RETRYABLE_STATUSES.has(status);
};
/** Whether an Auth error means the user no longer exists. */
const isUserNotFoundError = (error) => errorField(error, "code") === "user_not_found" || errorField(error, "status") === 404;
const sleep = (ms) => new Promise((resolve) => {
	setTimeout(resolve, ms);
});
const hasClose = (value) => typeof value === "object" && value !== null && typeof value.close === "function";
/**
* Deletes an Auth user, retrying transient errors a bounded number of times.
* A user that is already gone is a success, so cleanup is idempotent.
*/
const deleteAuthUser = async (admin, userId, retry = {}) => {
	const attempts = Math.max(1, retry.attempts ?? DEFAULT_ATTEMPTS);
	const delayMs = retry.delayMs ?? DEFAULT_DELAY_MS;
	for (let attempt = 1;; attempt++) {
		let error;
		try {
			({error} = await admin.auth.admin.deleteUser(userId));
		} catch (thrown) {
			error = thrown;
		}
		if (!error || isUserNotFoundError(error)) return;
		if (attempt >= attempts || !isRetryableAuthError(error)) throw error;
		await sleep(delayMs * 2 ** (attempt - 1));
	}
};
const throwCollected = (message, errors) => {
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) throw new TestCleanupError(message, errors);
};
/**
* An RLS test harness: creates real Auth users through the admin API, signs
* them in on one publishable-key client, exposes a session-bound database
* handle, and cleans everything up.
*
* One harness per suite (`describe`), cleaned up in `afterAll`.
*/
function createRlsTestHarness(options) {
	const { admin, client, onCreateUser, retry } = options;
	const password = options.password ?? DEFAULT_PASSWORD;
	const db = options.createDb ? options.createDb(client) : void 0;
	let users = [];
	let currentUser;
	const createUser = async (parameters = {}) => {
		const { options: userOptions, ...overrides } = parameters;
		const attributes = {
			email: `zeno-test-${crypto.randomUUID()}@example.test`,
			email_confirm: true,
			password,
			...options.createUserAttributes?.(),
			...overrides
		};
		if (attributes.phone) attributes.phone_confirm ??= true;
		const { data, error } = await admin.auth.admin.createUser(attributes);
		if (error) throw error;
		const user = {
			...data.user,
			email: data.user.email ?? attributes.email ?? "",
			password: attributes.password ?? password
		};
		users.push(user);
		await onCreateUser?.(user, userOptions, { admin });
		return user;
	};
	const signIn = async (credentials) => {
		const { data, error } = await client.auth.signInWithPassword(credentials);
		if (error) throw error;
		if (!data.session) throw new Error(`Sign-in for ${credentials.email} returned no session`);
		currentUser = data.user;
		return data.user;
	};
	const signOut = async () => {
		const { error } = await client.auth.signOut({ scope: "local" });
		currentUser = void 0;
		if (error) throw error;
	};
	const deleteUser = async (user) => {
		await deleteAuthUser(admin, user.id, retry);
		users = users.filter((tracked) => tracked.id !== user.id);
	};
	const cleanUpUsers = async () => {
		const errors = (await Promise.all(users.map((user) => deleteUser(user).then(() => void 0, (error) => ({ error }))))).flatMap((result) => result ? [result.error] : []);
		throwCollected(`Failed to delete ${errors.length} test users`, errors);
	};
	const cleanUp = async () => {
		const errors = [];
		const steps = [
			cleanUpUsers,
			signOut,
			async () => {
				if (hasClose(db)) await db.close();
			}
		];
		for (const step of steps) try {
			await step();
		} catch (error) {
			errors.push(error);
		}
		throwCollected("Test harness cleanup failed", errors);
	};
	return {
		cleanUp,
		cleanUpUsers,
		client,
		createUser,
		createUserAndSignIn: async (parameters) => {
			const user = await createUser(parameters);
			await signIn(user);
			return user;
		},
		get currentUser() {
			return currentUser;
		},
		db,
		deleteUser,
		refreshCurrentUser: async () => {
			const { data } = await client.auth.getUser();
			currentUser = data.user ?? void 0;
			return currentUser;
		},
		signIn,
		signOut,
		get users() {
			return users;
		}
	};
}
/**
* Signs out, then — unless `options` is `null` — signs in as a **fresh** user
* created with `options`. `null` leaves the harness signed out: the `anon` case.
*
* A new user each time rather than a reused one: custom claims such as roles
* are typically read by an access-token hook when the token is minted, so
* granting them to an already signed-in user changes nothing until the next
* sign-in.
*/
const signInAs = async (harness, options) => {
	await harness.signOut();
	if (options === null) return;
	return await harness.createUserAndSignIn({ options });
};
async function idsSeen(read, key) {
	const pick = key ?? ((row) => row.id);
	return new Set((await read()).map(pick));
}
//#endregion
export { TestCleanupError, createRlsTestHarness, deleteAuthUser, idsSeen, isRetryableAuthError, isUserNotFoundError, signInAs };
