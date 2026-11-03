// https://orm.drizzle.team/docs/rls#using-with-supabase
import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import type { AnyRelations, EmptyRelations } from "drizzle-orm"
import { is, SQL, sql } from "drizzle-orm"
import type { DrizzlePgConfig } from "drizzle-orm/pg-core"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { createRlsQueryClient } from "./rls-query-client.ts"

// Roles a user token may switch into. A forged/unexpected `role` claim is
// clamped to `anon`; the privileged `service_role` is reachable only via the
// explicit `createServiceClient`, never from a JWT.
const ALLOWED_RLS_ROLES = new Set(["anon", "authenticated"])

type CloseFn = (options?: { timeout?: number }) => Promise<void>

// Drizzle config minus the connection, which the factory resolves from
// `SUPABASE_DATABASE_URL` (or the optional override).
export type CreateClientConfig<
  TRelations extends AnyRelations = EmptyRelations,
> = DrizzlePgConfig<TRelations> & {
  /** Overrides `process.env.SUPABASE_DATABASE_URL`. */
  connectionString?: string
  /**
   * Require the Supabase transaction pooler: port 6543 on a non-local host.
   * Pass `true` in production (e.g. `process.env.VERCEL_ENV === "production"`)
   * to fail at client creation rather than exhaust connections under load.
   * Default `false`, which checks only that a URL is present.
   */
  requirePooler?: boolean
}

/** Whose session `sessionRevocation` decides on. */
export type SessionRevocationContext = {
  /**
   * The claims the client runs as, verified by `getClaims()` in
   * `createAuthClient` and `createRequestDb`.
   */
  claims: Partial<JwtPayload>
  sub: string
}

/**
 * `CreateClientConfig` for a client that runs as a user, plus the `app.via`
 * marker its transactions carry, whether they may write, and the check that
 * refuses a revoked session.
 */
export type RlsClientConfig<TRelations extends AnyRelations = EmptyRelations> =
  CreateClientConfig<TRelations> & {
    /**
     * Who acts for the user ("Claude", "AI assistant"). Every transaction sets
     * it as `app.via` in the same statement as the claims, so a trigger reads
     * `nullif(current_setting('app.via', true), '')`. Unset, it is `''`.
     */
    via?: string
    /**
     * Runs every transaction read-only (`transaction_read_only`), so a write
     * fails with Postgres's own error. Default `false`.
     */
    readOnly?: boolean
    /**
     * A SQL expression that yields a text code once the server ended the
     * session, or `NULL`. It runs after the claims are set, so `auth.uid()`
     * works, and before the role switch, as the login role.
     */
    sessionRevocation?: (
      context: SessionRevocationContext
    ) => SQL<string | null>
  }

/**
 * Thrown when a request carries no verified session. A named class so a caller
 * with a legitimate answer for that case (a permission check, where "not signed
 * in" means "no") can tell it apart from a real failure with `instanceof`.
 */
export class UnauthenticatedError extends Error {
  /** The verifier's own error, when there was one (an expired token, an ended session). */
  declare readonly cause?: unknown

  constructor(
    message = "Unauthorized: no verified session on this request",
    options?: { cause?: unknown }
  ) {
    super(message)
    this.name = "UnauthenticatedError"
    if (options) {
      Object.defineProperty(this, "cause", { value: options.cause })
    }
  }
}

/** Thrown when `sessionRevocation` yields a code, such as `user_banned`. */
export class SessionRevokedError extends UnauthenticatedError {
  readonly code: string

  constructor(code: string) {
    super(`Unauthorized: the session is revoked (${code})`)
    this.name = "SessionRevokedError"
    this.code = code
  }
}

export type ResolveDatabaseUrlOptions = Pick<
  CreateClientConfig,
  "connectionString" | "requirePooler"
>

const POOLER_PORT = "6543"
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "0.0.0.0"])

/**
 * The connection string every factory uses: `connectionString`, else
 * `SUPABASE_DATABASE_URL`. Throws when neither is set, and with
 * `requirePooler` also when the URL is not the transaction pooler. Read per
 * call, never at import, so a build without server secrets does not fail.
 * Errors never echo the URL, which carries the password.
 */
export function resolveDatabaseUrl({
  connectionString,
  requirePooler = false,
}: ResolveDatabaseUrlOptions = {}): string {
  const url = connectionString ?? process.env.SUPABASE_DATABASE_URL ?? ""
  if (!url) {
    throw new Error("Missing SUPABASE_DATABASE_URL environment variable")
  }
  if (!requirePooler) {
    return url
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    // biome-ignore lint/style/useErrorCause: Node's ERR_INVALID_URL keeps the raw URL (and its password) in `input`, so attaching it as the cause would echo the secret.
    throw new Error("SUPABASE_DATABASE_URL is not a valid URL")
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(
      `SUPABASE_DATABASE_URL must be a postgresql:// URL, got ${parsed.protocol}//`
    )
  }
  if (LOCAL_HOSTS.has(parsed.hostname)) {
    throw new Error(
      "SUPABASE_DATABASE_URL points at a local database, but the transaction pooler is required"
    )
  }
  if (parsed.port !== POOLER_PORT) {
    throw new Error(
      `SUPABASE_DATABASE_URL must use the transaction pooler (port ${POOLER_PORT}), got port ${parsed.port || "(default)"}. Session mode holds one connection per instance for its whole lifetime.`
    )
  }
  return url
}

// A directly-queryable Drizzle client plus a reference-counted `close()`.
export type DrizzleClient<TRelations extends AnyRelations = EmptyRelations> =
  PostgresJsDatabase<TRelations> & { close: CloseFn }

// The JWT claims every RLS client needs.
export type SupabaseToken = Pick<JwtPayload, "role" | "sub">

// The role-clamped RLS context installed into each transaction.
type RlsContext = { claims: string; role: string; sub: string }

// Clamps a token's role to the allowlist and re-serializes the claims so a
// policy reading auth.jwt()->>'role' can never disagree with the role the
// transaction switches to.
function clampClaims(token: Partial<SupabaseToken>): RlsContext {
  const role =
    token.role && ALLOWED_RLS_ROLES.has(token.role) ? token.role : "anon"
  return {
    claims: JSON.stringify({ ...token, role }),
    role,
    sub: token.sub ?? "",
  }
}

// Trusted role chosen by the caller (not read from a JWT), so it skips the
// user-token allowlist.
function fixedContext(role: string): RlsContext {
  return { claims: JSON.stringify({ role }), role, sub: "" }
}

// Pools are cached by kind + connection string. "admin" and "rls" get separate
// pools on the same URL so the admin connection is never role-switched. Each
// handle shares the cached pool and reference-counts it, so a per-request
// `close()` ends the pool only once the last handle releases it.
type PoolKind = "admin" | "rls"
type PoolEntry = {
  readonly client: ReturnType<typeof postgres>
  readonly key: string
  ended: boolean
  refCount: number
}
const poolCache = new Map<string, PoolEntry>()

function acquirePool(connectionString: string, kind: PoolKind): PoolEntry {
  const key = `${kind} ${connectionString}`
  let entry = poolCache.get(key)
  if (!entry) {
    // `prepare: false` is required for the Supabase transaction-mode pooler
    // (port 6543), which doesn't support prepared statements.
    entry = {
      client: postgres(connectionString, { prepare: false }),
      ended: false,
      key,
      refCount: 0,
    }
    poolCache.set(key, entry)
  }
  entry.refCount += 1
  return entry
}

function makeClose(entry: PoolEntry): CloseFn {
  let released = false
  // Idempotent per handle: closing twice must not double-decrement the pool.
  return async (options) => {
    if (released) {
      return
    }
    released = true
    entry.refCount -= 1
    if (entry.refCount <= 0 && !entry.ended) {
      entry.ended = true
      if (poolCache.get(entry.key) === entry) {
        poolCache.delete(entry.key)
      }
      await entry.client.end(options)
    }
  }
}

// Resolves the connection string, acquires the shared pool, and builds a fresh
// (cheap) per-handle drizzle instance over it.
function buildDrizzle<TRelations extends AnyRelations>(
  kind: PoolKind,
  config?: CreateClientConfig<TRelations>
): { close: CloseFn; db: PostgresJsDatabase<TRelations> } {
  const { connectionString, requirePooler, ...drizzleConfig } = config ?? {}
  const url = resolveDatabaseUrl({ connectionString, requirePooler })
  const entry = acquirePool(url, kind)
  const db = drizzle<TRelations>({
    client: entry.client,
    ...(drizzleConfig as DrizzlePgConfig<TRelations>),
  })
  return { close: makeClose(entry), db }
}

// What a client adds to the claims statement of each of its transactions.
type TransactionSettings = { check?: SQL; readOnly: boolean; via: string }

// With a `sessionRevocation` check, the claims and `app.via` go in first, the
// check runs next, still as the login role, and the role and read-only mode
// switch last. Each `offset 0` keeps its subquery whole, the scalar
// `(select ...)` turns no row into NULL, and the newline ends a `--` comment
// in the check.
const claimsStatement = (
  { claims, role, sub }: RlsContext,
  { check, readOnly, via }: TransactionSettings
) => {
  const readOnlyClause = readOnly
    ? sql`, set_config('transaction_read_only', 'on', true)`
    : sql``
  return check
    ? sql`select set_config('role', ${role}, true)${readOnlyClause}, checked.revocation from (select (select (${check}
)) as revocation from (select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${sub}, true), set_config('app.via', ${via}, true) offset 0) as claims offset 0) as checked`
    : sql`select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${sub}, true), set_config('app.via', ${via}, true), set_config('role', ${role}, true)${readOnlyClause}`
}

// Calls the app's check with its own copy of the claims, and refuses anything
// but SQL, such as a promise from an async callback.
function revocationCheck(
  sessionRevocation: NonNullable<RlsClientConfig["sessionRevocation"]>,
  { claims, sub }: RlsContext
): SQL {
  const check: unknown = sessionRevocation({ claims: JSON.parse(claims), sub })
  if (!is(check, SQL)) {
    throw new TypeError("sessionRevocation must return a SQL expression")
  }
  return check
}

// Sets the claims, `app.via`, the role and read-only mode for the rest of
// `tx`, and throws when the check yields a code.
async function setRlsContext(
  tx: Pick<PostgresJsDatabase, "execute">,
  context: RlsContext,
  settings: TransactionSettings
): Promise<void> {
  const [row] = await tx.execute<{ revocation?: unknown }>(
    claimsStatement(context, settings)
  )
  // Never run the caller's statements without the role switch.
  if (!row) {
    throw new Error("The claims statement returned no row")
  }
  const code = row.revocation ?? null
  if (code === null) {
    return
  }
  if (typeof code !== "string") {
    throw new TypeError("sessionRevocation must yield a text code or NULL")
  }
  throw new SessionRevokedError(code)
}

// Wraps a drizzle instance in the lazy RLS query proxy. Claims are resolved
// before each transaction opens (so `createAuthClient` re-checks the live
// session for each one), then installed transaction-locally with
// `set_config(..., true)`, which auto-resets at commit. The role goes through
// `set_config('role', ...)`, which is what `set local role` does, so claims,
// via and role cost one round trip, and the role is a bound parameter. `app.via`
// must stay in this statement: a separate one is its own transaction, and the
// value is gone before the write it labels. Turning a transaction read-only
// is allowed after its first query; only the way back is not.
function buildRlsClient<TRelations extends AnyRelations>(
  resolveContext: () => Promise<RlsContext>,
  config?: RlsClientConfig<TRelations>
): DrizzleClient<TRelations> {
  const {
    readOnly = false,
    sessionRevocation,
    via = "",
    ...clientConfig
  } = config ?? {}
  const { close, db } = buildDrizzle("rls", clientConfig)
  const runTransaction = async (transaction: (tx: unknown) => unknown) => {
    const context = await resolveContext()
    const check =
      sessionRevocation && context.sub
        ? revocationCheck(sessionRevocation, context)
        : undefined
    return db.transaction(async (tx) => {
      await setRlsContext(tx, context, { check, readOnly, via })
      return transaction(tx)
    })
  }
  return createRlsQueryClient(
    runTransaction,
    close
  ) as DrizzleClient<TRelations>
}

/**
 * RLS-bypassing client (the docs' `admin`). Connects with
 * `SUPABASE_DATABASE_URL` and queries drizzle directly. Use for webhooks,
 * background jobs, and seeding, never for user-scoped reads/writes.
 */
export function createAdminClient<
  TRelations extends AnyRelations = EmptyRelations,
>(config?: CreateClientConfig<TRelations>): DrizzleClient<TRelations> {
  const { close, db } = buildDrizzle("admin", config)
  return Object.assign(db, { close })
}

/**
 * RLS client scoped to an already-verified, decoded token (e.g. from
 * `supabase.auth.getClaims()`). The role is clamped to the allowlist.
 */
export function createSupabaseClient<
  TRelations extends AnyRelations = EmptyRelations,
>(
  accessToken: SupabaseToken,
  config?: RlsClientConfig<TRelations>
): DrizzleClient<TRelations> {
  const context = clampClaims(accessToken)
  return buildRlsClient(() => Promise.resolve(context), config)
}

/**
 * RLS client bound to a Supabase client. Verified claims are resolved via
 * `supabase.auth.getClaims()` before every transaction (every query outside
 * `db.transaction`), so it sees a sign-out at once, and a ban or a deletion
 * with `sessionRevocation`.
 */
export function createAuthClient<
  TRelations extends AnyRelations = EmptyRelations,
>(
  supabase: SupabaseClient,
  config?: RlsClientConfig<TRelations>
): DrizzleClient<TRelations> {
  return buildRlsClient(async () => {
    const { data, error } = await supabase.auth.getClaims()
    if (error) {
      throw error
    }
    return clampClaims(data?.claims ?? {})
  }, config)
}

/** RLS client that runs every query as the `anon` role. */
export function createAnonClient<
  TRelations extends AnyRelations = EmptyRelations,
>(config?: CreateClientConfig<TRelations>): DrizzleClient<TRelations> {
  return buildRlsClient(() => Promise.resolve(fixedContext("anon")), config)
}

/**
 * Client that runs every query as `service_role`, which bypasses RLS via
 * Supabase's BYPASSRLS grant. Use for trusted server-side work.
 */
export function createServiceClient<
  TRelations extends AnyRelations = EmptyRelations,
>(config?: CreateClientConfig<TRelations>): DrizzleClient<TRelations> {
  return buildRlsClient(
    () => Promise.resolve(fixedContext("service_role")),
    config
  )
}
