// https://orm.drizzle.team/docs/rls#using-with-supabase
import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import type { AnyRelations, EmptyRelations } from "drizzle-orm"
import { sql } from "drizzle-orm"
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
}

// A directly-queryable Drizzle client plus a reference-counted `close()`.
export type DrizzleClient<TRelations extends AnyRelations = EmptyRelations> =
  PostgresJsDatabase<TRelations> & { close: CloseFn }

// The only JWT claims the RLS clients read.
export type SupabaseToken = Pick<JwtPayload, "role" | "sub">

// The role-clamped RLS context installed into each transaction.
type RlsContext = { claims: string; role: string; sub: string }

// Clamps a token's role to the allowlist and re-serializes the claims so a
// policy reading auth.jwt()->>'role' can never disagree with the role we
// `set local role` to.
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
  const { connectionString, ...drizzleConfig } = config ?? {}
  const url = connectionString ?? process.env.SUPABASE_DATABASE_URL ?? ""
  if (!url) {
    throw new Error("Missing SUPABASE_DATABASE_URL environment variable")
  }
  const entry = acquirePool(url, kind)
  const db = drizzle<TRelations>({
    client: entry.client,
    ...(drizzleConfig as DrizzlePgConfig<TRelations>),
  })
  return { close: makeClose(entry), db }
}

// Wraps a drizzle instance in the lazy RLS query proxy. Claims are resolved
// before each transaction opens (so `createAuthClient` re-checks the live
// session per query), then installed transaction-locally via
// `set_config(..., true)` + `set local role`, which auto-reset at commit.
function buildRlsClient<TRelations extends AnyRelations>(
  resolveContext: () => Promise<RlsContext>,
  config?: CreateClientConfig<TRelations>
): DrizzleClient<TRelations> {
  const { close, db } = buildDrizzle("rls", config)
  const runTransaction = async (transaction: (tx: unknown) => unknown) => {
    const { claims, role, sub } = await resolveContext()
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${sub}, true)`
      )
      await tx.execute(sql`set local role ${sql.raw(role)}`)
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
  config?: CreateClientConfig<TRelations>
): DrizzleClient<TRelations> {
  const context = clampClaims(accessToken)
  return buildRlsClient(() => Promise.resolve(context), config)
}

/**
 * RLS client bound to a Supabase client. Verified claims are resolved via
 * `supabase.auth.getClaims()` on every query, so it always reflects the live
 * session.
 */
export function createAuthClient<
  TRelations extends AnyRelations = EmptyRelations,
>(
  supabase: SupabaseClient,
  config?: CreateClientConfig<TRelations>
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
