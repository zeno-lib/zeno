import { AdminUserAttributes, SupabaseClient, User } from "@supabase/supabase-js";
//#region src/supabase.d.ts
type AuthApi = SupabaseClient["auth"];
/**
 * The slice of a Supabase client the harness signs in with. Any
 * `SupabaseClient<Database>` satisfies it; pass one built with the
 * publishable (anon) key so it honours RLS.
 */
interface HarnessClient {
  auth: Pick<AuthApi, "getUser" | "signInWithPassword" | "signOut">;
}
/**
 * The slice of a service-role Supabase client the harness creates and deletes
 * users with. Any `SupabaseClient<Database>` built with the secret key
 * satisfies it.
 */
interface HarnessAdminClient {
  auth: {
    admin: Pick<AuthApi["admin"], "createUser" | "deleteUser">;
  };
}
/** A user the harness created: the Auth user plus the credentials it signs in with. */
type TestUser = User & {
  email: string;
  password: string;
};
/** `auth.admin.createUser` attributes, plus the consumer's own per-user `options`. */
type CreateTestUserParameters<TOptions> = Partial<AdminUserAttributes> & {
  /** Handed to `onCreateUser` untouched, e.g. `{ roles: ["ADMIN"] }`. */
  options?: TOptions;
};
interface RetryOptions {
  /** Total tries per call, first one included. Default `4`. */
  attempts?: number;
  /** Delay before the first retry; doubles on each further one. Default `200`. */
  delayMs?: number;
}
interface RlsTestHarnessOptions<TClient extends HarnessClient, TAdmin extends HarnessAdminClient, TDb, TOptions> {
  /** Service-role client: creates and deletes users. Never used for the reads under test. */
  admin: TAdmin;
  /** Publishable-key client the harness signs in and out on. */
  client: TClient;
  /**
   * Builds the RLS-scoped database handle once, bound to `client`. It must
   * re-read the session per query (e.g. `@zeno-lib/db`'s `createAuthClient`),
   * so the same handle is `anon` while signed out and the user after
   * `signIn`. If it has a `close()`, `cleanUp()` calls it.
   */
  createDb?: (client: TClient) => TDb;
  /**
   * Default attributes for each new user, called once per user and overridden
   * by the attributes passed to `createUser`. Use it for random names or
   * metadata. The email defaults to a random `@example.test` address.
   */
  createUserAttributes?: () => Partial<AdminUserAttributes>;
  /**
   * Domain-specific setup after the Auth user exists and before `createUser`
   * resolves, e.g. inserting role or membership rows with `admin`. The user is
   * already tracked, so `cleanUp()` still deletes it if this throws. Rows it
   * inserts must cascade from `auth.users` or be deleted by the caller first.
   */
  onCreateUser?: (user: TestUser, options: TOptions | undefined, context: {
    admin: TAdmin;
  }) => Promise<void> | void;
  /** Password for users created without one. Default `"zeno-test-password"`. */
  password?: string;
  /** Bounded retry for retryable Auth errors while deleting users. */
  retry?: RetryOptions;
}
interface RlsTestHarness<TClient, TDb, TOptions> {
  /** Deletes every tracked user, signs out, and closes `db`; see `cleanUpUsers`. */
  cleanUp(): Promise<void>;
  /**
   * Deletes every tracked user. Retryable Auth errors are retried, a user
   * that is already gone counts as deleted, and every user is attempted before
   * the remaining failures are thrown together as a `TestCleanupError`.
   */
  cleanUpUsers(): Promise<void>;
  readonly client: TClient;
  createUser(parameters?: CreateTestUserParameters<TOptions>): Promise<TestUser>;
  createUserAndSignIn(parameters?: CreateTestUserParameters<TOptions>): Promise<TestUser>;
  /** The signed-in user, or `undefined` while signed out (`anon`). */
  readonly currentUser: User | undefined;
  /** The handle `createDb` returned (`undefined` without one). Built once; capture it freely. */
  readonly db: TDb;
  deleteUser(user: Pick<User, "id">): Promise<void>;
  /** Re-reads the user from Auth (a network call); sign-in and sign-out already keep `currentUser` current. */
  refreshCurrentUser(): Promise<User | undefined>;
  signIn(credentials: {
    email: string;
    password: string;
  }): Promise<User>;
  /** Drops the session locally (`scope: "local"`); no Auth round trip. */
  signOut(): Promise<void>;
  /** Users created and not yet deleted. */
  readonly users: readonly TestUser[];
}
/** Thrown by cleanup when one or more steps still failed; `errors` holds each cause. */
declare class TestCleanupError extends Error {
  readonly errors: readonly unknown[];
  constructor(message: string, errors: readonly unknown[]);
}
/**
 * Whether an Auth error is transient. Matched by shape rather than with
 * `isAuthRetryableFetchError`, so an error from a second copy of
 * `@supabase/auth-js` still counts.
 */
declare const isRetryableAuthError: (error: unknown) => boolean;
/** Whether an Auth error means the user no longer exists. */
declare const isUserNotFoundError: (error: unknown) => boolean;
/**
 * Deletes an Auth user, retrying transient errors a bounded number of times.
 * A user that is already gone is a success, so cleanup is idempotent.
 */
declare const deleteAuthUser: (admin: HarnessAdminClient, userId: string, retry?: RetryOptions) => Promise<void>;
/**
 * An RLS test harness: creates real Auth users through the admin API, signs
 * them in on one publishable-key client, exposes a session-bound database
 * handle, and cleans everything up.
 *
 * One harness per suite (`describe`), cleaned up in `afterAll`.
 */
declare function createRlsTestHarness<TClient extends HarnessClient, TAdmin extends HarnessAdminClient, TDb = undefined, TOptions = undefined>(options: RlsTestHarnessOptions<TClient, TAdmin, TDb, TOptions>): RlsTestHarness<TClient, TDb, TOptions>;
/**
 * Signs out, then — unless `options` is `null` — signs in as a **fresh** user
 * created with `options`. `null` leaves the harness signed out: the `anon` case.
 *
 * A new user each time rather than a reused one: custom claims such as roles
 * are typically read by an access-token hook when the token is minted, so
 * granting them to an already signed-in user changes nothing until the next
 * sign-in.
 */
declare const signInAs: <TOptions>(harness: Pick<RlsTestHarness<unknown, unknown, TOptions>, "createUserAndSignIn" | "signOut">, options: TOptions | null) => Promise<TestUser | undefined>;
/**
 * The set of keys a read returns as whoever is signed in — `row.id` by
 * default, or whatever `key` picks.
 *
 * Compare keys, not rows: visibility is what an RLS suite proves, the row
 * shape is the domain's business. Assert the **exact** expected set: an empty
 * set is also what a broken claims install looks like, so "saw something" is
 * not enough.
 */
declare function idsSeen<TId>(read: () => PromiseLike<readonly {
  id: TId;
}[]>): Promise<Set<TId>>;
declare function idsSeen<TRow, TKey>(read: () => PromiseLike<readonly TRow[]>, key: (row: TRow) => TKey): Promise<Set<TKey>>;
//#endregion
export { CreateTestUserParameters, HarnessAdminClient, HarnessClient, RetryOptions, RlsTestHarness, RlsTestHarnessOptions, TestCleanupError, TestUser, createRlsTestHarness, deleteAuthUser, idsSeen, isRetryableAuthError, isUserNotFoundError, signInAs };