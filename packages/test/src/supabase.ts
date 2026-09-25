import type {
  AdminUserAttributes,
  SupabaseClient,
  User,
} from "@supabase/supabase-js"

type AuthApi = SupabaseClient["auth"]

/**
 * The slice of a Supabase client the harness signs in with. Any
 * `SupabaseClient<Database>` satisfies it; pass one built with the
 * publishable (anon) key so it honours RLS.
 */
export interface HarnessClient {
  auth: Pick<AuthApi, "getUser" | "signInWithPassword" | "signOut">
}

/**
 * The slice of a service-role Supabase client the harness creates and deletes
 * users with. Any `SupabaseClient<Database>` built with the secret key
 * satisfies it.
 */
export interface HarnessAdminClient {
  auth: { admin: Pick<AuthApi["admin"], "createUser" | "deleteUser"> }
}

/** A user the harness created: the Auth user plus the credentials it signs in with. */
export type TestUser = User & { email: string; password: string }

/** `auth.admin.createUser` attributes, plus the consumer's own per-user `options`. */
export type CreateTestUserParameters<TOptions> =
  Partial<AdminUserAttributes> & {
    /** Handed to `onCreateUser` untouched, e.g. `{ roles: ["ADMIN"] }`. */
    options?: TOptions
  }

export interface RetryOptions {
  /** Total tries per call, first one included. Default `4`. */
  attempts?: number
  /** Delay before the first retry; doubles on each further one. Default `200`. */
  delayMs?: number
}

export interface RlsTestHarnessOptions<
  TClient extends HarnessClient,
  TAdmin extends HarnessAdminClient,
  TDb,
  TOptions,
> {
  /** Service-role client: creates and deletes users. Never used for the reads under test. */
  admin: TAdmin
  /** Publishable-key client the harness signs in and out on. */
  client: TClient
  /**
   * Builds the RLS-scoped database handle once, bound to `client`. It must
   * re-read the session per query (e.g. `@zeno-lib/db`'s `createAuthClient`),
   * so the same handle is `anon` while signed out and the user after
   * `signIn`. If it has a `close()`, `cleanUp()` calls it.
   */
  createDb?: (client: TClient) => TDb
  /**
   * Default attributes for each new user, called once per user and overridden
   * by the attributes passed to `createUser`. Use it for random names or
   * metadata. The email defaults to a random `@example.test` address.
   */
  createUserAttributes?: () => Partial<AdminUserAttributes>
  /**
   * Domain-specific setup after the Auth user exists and before `createUser`
   * resolves, e.g. inserting role or membership rows with `admin`. The user is
   * already tracked, so `cleanUp()` still deletes it if this throws. Rows it
   * inserts must cascade from `auth.users` or be deleted by the caller first.
   */
  onCreateUser?: (
    user: TestUser,
    options: TOptions | undefined,
    context: { admin: TAdmin }
  ) => Promise<void> | void
  /** Password for users created without one. Default `"zeno-test-password"`. */
  password?: string
  /** Bounded retry for retryable Auth errors while deleting users. */
  retry?: RetryOptions
}

export interface RlsTestHarness<TClient, TDb, TOptions> {
  /** Deletes every tracked user, signs out, and closes `db`; see `cleanUpUsers`. */
  cleanUp(): Promise<void>
  /**
   * Deletes every tracked user. Retryable Auth errors are retried, a user
   * that is already gone counts as deleted, and every user is attempted before
   * the remaining failures are thrown together as a `TestCleanupError`.
   */
  cleanUpUsers(): Promise<void>
  readonly client: TClient
  createUser(parameters?: CreateTestUserParameters<TOptions>): Promise<TestUser>
  createUserAndSignIn(
    parameters?: CreateTestUserParameters<TOptions>
  ): Promise<TestUser>
  /** The signed-in user, or `undefined` while signed out (`anon`). */
  readonly currentUser: User | undefined
  /** The handle `createDb` returned (`undefined` without one). Built once; capture it freely. */
  readonly db: TDb
  deleteUser(user: Pick<User, "id">): Promise<void>
  /** Re-reads the user from Auth (a network call); sign-in and sign-out already keep `currentUser` current. */
  refreshCurrentUser(): Promise<User | undefined>
  signIn(credentials: { email: string; password: string }): Promise<User>
  /** Drops the session locally (`scope: "local"`); no Auth round trip. */
  signOut(): Promise<void>
  /** Users created and not yet deleted. */
  readonly users: readonly TestUser[]
}

/** Thrown by cleanup when one or more steps still failed; `errors` holds each cause. */
export class TestCleanupError extends Error {
  readonly errors: readonly unknown[]

  constructor(message: string, errors: readonly unknown[]) {
    super(message)
    this.name = "TestCleanupError"
    this.errors = errors
  }
}

const DEFAULT_PASSWORD = "zeno-test-password"
const DEFAULT_ATTEMPTS = 4
const DEFAULT_DELAY_MS = 200
// 429 rate limit and the gateway family. A 500 is not here: deleting a user a
// non-cascading foreign key still references is a 500 that no retry fixes.
const RETRYABLE_STATUSES = new Set([429, 502, 503, 504])

const errorField = (error: unknown, field: string): unknown =>
  typeof error === "object" && error !== null && field in error
    ? (error as Record<string, unknown>)[field]
    : undefined

/**
 * Whether an Auth error is transient. Matched by shape rather than with
 * `isAuthRetryableFetchError`, so an error from a second copy of
 * `@supabase/auth-js` still counts.
 */
export const isRetryableAuthError = (error: unknown): boolean => {
  if (errorField(error, "name") === "AuthRetryableFetchError") {
    return true
  }
  const status = errorField(error, "status")
  return typeof status === "number" && RETRYABLE_STATUSES.has(status)
}

/** Whether an Auth error means the user no longer exists. */
export const isUserNotFoundError = (error: unknown): boolean =>
  errorField(error, "code") === "user_not_found" ||
  errorField(error, "status") === 404

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const hasClose = (value: unknown): value is { close: () => unknown } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { close?: unknown }).close === "function"

/**
 * Deletes an Auth user, retrying transient errors a bounded number of times.
 * A user that is already gone is a success, so cleanup is idempotent.
 */
export const deleteAuthUser = async (
  admin: HarnessAdminClient,
  userId: string,
  retry: RetryOptions = {}
): Promise<void> => {
  const attempts = Math.max(1, retry.attempts ?? DEFAULT_ATTEMPTS)
  const delayMs = retry.delayMs ?? DEFAULT_DELAY_MS

  for (let attempt = 1; ; attempt++) {
    let error: unknown
    try {
      ;({ error } = await admin.auth.admin.deleteUser(userId))
    } catch (thrown) {
      error = thrown
    }

    if (!error || isUserNotFoundError(error)) {
      return
    }
    if (attempt >= attempts || !isRetryableAuthError(error)) {
      throw error
    }
    await sleep(delayMs * 2 ** (attempt - 1))
  }
}

const throwCollected = (message: string, errors: unknown[]) => {
  if (errors.length === 1) {
    throw errors[0]
  }
  if (errors.length > 1) {
    throw new TestCleanupError(message, errors)
  }
}

/**
 * An RLS test harness: creates real Auth users through the admin API, signs
 * them in on one publishable-key client, exposes a session-bound database
 * handle, and cleans everything up.
 *
 * One harness per suite (`describe`), cleaned up in `afterAll`.
 */
export function createRlsTestHarness<
  TClient extends HarnessClient,
  TAdmin extends HarnessAdminClient,
  TDb = undefined,
  TOptions = undefined,
>(
  options: RlsTestHarnessOptions<TClient, TAdmin, TDb, TOptions>
): RlsTestHarness<TClient, TDb, TOptions> {
  const { admin, client, onCreateUser, retry } = options
  const password = options.password ?? DEFAULT_PASSWORD
  // Without `createDb` the default `TDb` is `undefined`, which this is.
  const db = (options.createDb ? options.createDb(client) : undefined) as TDb
  let users: TestUser[] = []
  let currentUser: User | undefined

  const createUser = async (
    parameters: CreateTestUserParameters<TOptions> = {}
  ): Promise<TestUser> => {
    const { options: userOptions, ...overrides } = parameters
    const attributes: AdminUserAttributes = {
      email: `zeno-test-${crypto.randomUUID()}@example.test`,
      email_confirm: true,
      password,
      ...options.createUserAttributes?.(),
      ...overrides,
    }
    if (attributes.phone) {
      attributes.phone_confirm ??= true
    }

    const { data, error } = await admin.auth.admin.createUser(attributes)
    if (error) {
      throw error
    }

    const user: TestUser = {
      ...data.user,
      email: data.user.email ?? attributes.email ?? "",
      password: attributes.password ?? password,
    }
    users.push(user)
    await onCreateUser?.(user, userOptions, { admin })

    return user
  }

  const signIn = async (credentials: { email: string; password: string }) => {
    const { data, error } = await client.auth.signInWithPassword(credentials)
    if (error) {
      throw error
    }
    if (!data.session) {
      throw new Error(`Sign-in for ${credentials.email} returned no session`)
    }
    currentUser = data.user
    return data.user
  }

  const signOut = async () => {
    const { error } = await client.auth.signOut({ scope: "local" })
    currentUser = undefined
    if (error) {
      throw error
    }
  }

  const deleteUser = async (user: Pick<User, "id">) => {
    await deleteAuthUser(admin, user.id, retry)
    users = users.filter((tracked) => tracked.id !== user.id)
  }

  const cleanUpUsers = async () => {
    const results = await Promise.all(
      users.map((user) =>
        deleteUser(user).then(
          () => undefined,
          (error: unknown) => ({ error })
        )
      )
    )
    const errors = results.flatMap((result) => (result ? [result.error] : []))
    throwCollected(`Failed to delete ${errors.length} test users`, errors)
  }

  // Every step runs even if an earlier one failed: an unclosed postgres-js
  // pool keeps the event loop alive, so Vitest hangs instead of reporting.
  const cleanUp = async () => {
    const errors: unknown[] = []
    const steps = [
      cleanUpUsers,
      signOut,
      async () => {
        if (hasClose(db)) {
          await db.close()
        }
      },
    ]
    for (const step of steps) {
      try {
        await step()
      } catch (error) {
        errors.push(error)
      }
    }
    throwCollected("Test harness cleanup failed", errors)
  }

  return {
    cleanUp,
    cleanUpUsers,
    client,
    createUser,
    createUserAndSignIn: async (parameters) => {
      const user = await createUser(parameters)
      await signIn(user)
      return user
    },
    get currentUser() {
      return currentUser
    },
    db,
    deleteUser,
    refreshCurrentUser: async () => {
      const { data } = await client.auth.getUser()
      currentUser = data.user ?? undefined
      return currentUser
    },
    signIn,
    signOut,
    get users() {
      return users
    },
  }
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
export const signInAs = async <TOptions>(
  harness: Pick<
    RlsTestHarness<unknown, unknown, TOptions>,
    "createUserAndSignIn" | "signOut"
  >,
  options: TOptions | null
): Promise<TestUser | undefined> => {
  await harness.signOut()
  if (options === null) {
    return
  }
  return await harness.createUserAndSignIn({ options })
}

/**
 * The set of keys a read returns as whoever is signed in — `row.id` by
 * default, or whatever `key` picks.
 *
 * Compare keys, not rows: visibility is what an RLS suite proves, the row
 * shape is the domain's business. Assert the **exact** expected set: an empty
 * set is also what a broken claims install looks like, so "saw something" is
 * not enough.
 */
export function idsSeen<TId>(
  read: () => PromiseLike<readonly { id: TId }[]>
): Promise<Set<TId>>
export function idsSeen<TRow, TKey>(
  read: () => PromiseLike<readonly TRow[]>,
  key: (row: TRow) => TKey
): Promise<Set<TKey>>
export async function idsSeen<TRow, TKey>(
  read: () => PromiseLike<readonly TRow[]>,
  key?: (row: TRow) => TKey
): Promise<Set<TKey | unknown>> {
  const pick = key ?? ((row: TRow) => (row as { id: unknown }).id)
  return new Set((await read()).map(pick))
}
