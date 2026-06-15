// https://orm.drizzle.team/docs/rls#using-with-supabase
import type { AnyRelations, EmptyRelations } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

// Verified Supabase JWT claims used to drive Postgres RLS.
export type SupabaseTokenClaims = {
  sub?: string
  role?: string
  [claim: string]: unknown
}

export type SupabaseAuthClientLike = {
  auth: {
    getClaims: () => Promise<{
      data: { claims: SupabaseTokenClaims } | null
      error: unknown | null
    }>
  }
}

export type SupabaseAuthContext =
  | SupabaseAuthClientLike
  | SupabaseTokenClaims
  | null
  | undefined

// `set local role <ident>` can't be parameterized, so the role is interpolated
// via sql.raw. Restrict it to the Supabase-managed roles so a forged `role`
// claim can't inject SQL or switch into the service role.
const ALLOWED_RLS_ROLES = new Set(["anon", "authenticated"])

export type CreateDrizzleClientsOptions<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
> = {
  schema: TSchema
  // Relations object from drizzle's `defineRelations`. Required for the
  // relational query API (`db.query.<table>.findMany()`); drizzle v1 ignores
  // `schema` for relations. Pair a stable `relations` object with the stable
  // `schema` object so the pool cache can be reused.
  relations?: TRelations
  connectionString?: string
}

export type CreateSupabaseDrizzleOptions<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
> = CreateDrizzleClientsOptions<TSchema, TRelations> & {
  supabase?: SupabaseAuthContext
}

type DrizzleClients<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
> = ReturnType<typeof createDrizzleClients<TSchema, TRelations>>

// Cached pools are reference-counted so a request-scoped `close()` only ends the
// underlying pools once the last handle sharing them is closed.
type SharedDrizzleEntry = {
  clients: DrizzleClients<Record<string, unknown>, AnyRelations>
  refCount: number
}

const sharedClients = new WeakMap<
  Record<string, unknown>,
  Map<string, SharedDrizzleEntry>
>()

export function createDrizzleClients<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(options: CreateDrizzleClientsOptions<TSchema, TRelations>) {
  const url = options.connectionString ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable")
  }

  // prepare:false → required for the Supabase transaction pooler (port 6543).
  // Two separate pools: admin runs as the connection role (bypasses RLS),
  // rls switches role + sets JWT claims per transaction.
  // `relations` enables the relational query API on both clients (and inside
  // the rls transaction's `tx`).
  const adminPool = postgres(url, { prepare: false })
  const rlsPool = postgres(url, { prepare: false })
  const adminClient = drizzle<TRelations>({
    client: adminPool,
    relations: options.relations,
  })
  const rlsClient = drizzle<TRelations>({
    client: rlsPool,
    relations: options.relations,
  })

  // Bypasses RLS. Use for webhooks, admin tasks, background jobs, seeding.
  function getDrizzleSupabaseAdminClient(): PostgresJsDatabase<TRelations> {
    return adminClient
  }

  // RLS-aware. Pass either a Supabase client (preferred) or verified JWT
  // claims; every query MUST run inside `runTransaction` for the JWT context
  // (and thus RLS) to apply.
  function getDrizzleSupabaseClient(authContext?: SupabaseAuthContext) {
    const runTransaction = (async (transaction, txConfig) => {
      const token = await resolveTokenClaims(authContext)
      const sub = token.sub ?? ""
      const role =
        token.role && ALLOWED_RLS_ROLES.has(token.role) ? token.role : "anon"
      // Force the serialized claims' role to match the role we actually `set
      // local role` to, so a policy reading auth.jwt()->>'role' can never see a
      // value that disagrees with the live Postgres role (e.g. a service_role
      // claim that was downgraded to anon).
      const claims = JSON.stringify({ ...token, role })

      return await rlsClient.transaction(async (tx) => {
        // auth.jwt()/auth.uid() read these; is_local scopes them to the tx, so
        // they auto-reset when it commits or rolls back.
        await tx.execute(
          sql`select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${sub}, true)`
        )
        await tx.execute(sql`set local role ${sql.raw(role)}`)
        return await transaction(tx)
      }, txConfig)
    }) as typeof rlsClient.transaction

    return { runTransaction }
  }

  async function closeDrizzleSupabaseClients(
    options?: Parameters<typeof adminPool.end>[0]
  ): Promise<void> {
    await Promise.all([adminPool.end(options), rlsPool.end(options)])
  }

  return {
    closeDrizzleSupabaseClients,
    getDrizzleSupabaseAdminClient,
    getDrizzleSupabaseClient,
  }
}

export function createSupabaseDrizzle<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(options: CreateSupabaseDrizzleOptions<TSchema, TRelations>) {
  const cacheKey = createCacheKey(options)
  const entry = acquireSharedDrizzleClients(options, cacheKey)
  const {
    closeDrizzleSupabaseClients,
    getDrizzleSupabaseAdminClient,
    getDrizzleSupabaseClient,
  } = entry.clients
  type RlsTransaction = ReturnType<
    typeof getDrizzleSupabaseClient
  >["runTransaction"]
  // `null` is treated like `undefined`: with no auth context we must reject
  // loudly rather than silently fall back to an anon query.
  const rlsTransaction =
    options.supabase == null
      ? ((() =>
          Promise.reject(
            new Error(
              "Missing Supabase client for RLS. Pass { supabase } to createSupabaseDrizzle()."
            )
          )) as RlsTransaction)
      : getDrizzleSupabaseClient(options.supabase).runTransaction

  // Chainable single-statement RLS: `db.rls.select().from(table)` /
  // `db.rls.query.table.findMany()`. Records the call chain and replays it
  // inside one `rlsTransaction`, so RLS context is established in exactly one
  // place. Reach for `rlsTransaction(cb)` to run multiple statements atomically.
  const rls = createRlsProxy(
    rlsTransaction as (
      transaction: (tx: unknown) => unknown
    ) => Promise<unknown>
  ) as PostgresJsDatabase<TRelations>

  // Guard against double-close: each handle releases its reference at most once.
  let released = false

  return {
    admin: getDrizzleSupabaseAdminClient(),
    close: async (
      closeOptions?: Parameters<typeof closeDrizzleSupabaseClients>[0]
    ) => {
      if (released) {
        return
      }
      released = true
      entry.refCount -= 1
      // Other handles still share these pools — leave them open.
      if (entry.refCount > 0) {
        return
      }
      sharedClients.get(options.schema)?.delete(cacheKey)
      await closeDrizzleSupabaseClients(closeOptions)
    },
    rls,
    rlsTransaction,
  }
}

function acquireSharedDrizzleClients<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(
  options: CreateDrizzleClientsOptions<TSchema, TRelations>,
  cacheKey: string
): { clients: DrizzleClients<TSchema, TRelations>; refCount: number } {
  let schemaClients = sharedClients.get(options.schema)
  if (!schemaClients) {
    schemaClients = new Map()
    sharedClients.set(options.schema, schemaClients)
  }

  const existingEntry = schemaClients.get(cacheKey)
  if (existingEntry) {
    existingEntry.refCount += 1
    return existingEntry as unknown as {
      clients: DrizzleClients<TSchema, TRelations>
      refCount: number
    }
  }

  const entry: SharedDrizzleEntry = {
    clients: createDrizzleClients(options) as DrizzleClients<
      Record<string, unknown>,
      AnyRelations
    >,
    refCount: 1,
  }
  schemaClients.set(cacheKey, entry)
  return entry as unknown as {
    clients: DrizzleClients<TSchema, TRelations>
    refCount: number
  }
}

function createCacheKey<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(options: CreateDrizzleClientsOptions<TSchema, TRelations>): string {
  const url = options.connectionString ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable")
  }
  return JSON.stringify({ url })
}

// One recorded step of a chained call: `db.rls.select` is a get, the following
// `()` is an apply.
type RlsChainStep =
  | { kind: "get"; prop: PropertyKey }
  | { kind: "apply"; args: unknown[] }

// Walk the recorded chain against the live transaction `tx`, tracking the
// receiver so methods are invoked with the right `this`. Returns whatever the
// chain produces — a thenable drizzle builder, or a relational query promise.
function replayRlsChain(tx: unknown, path: RlsChainStep[]): unknown {
  let receiver: unknown = tx
  let current: unknown = tx
  for (const step of path) {
    if (step.kind === "get") {
      receiver = current
      current = (current as Record<PropertyKey, unknown>)[step.prop]
    } else {
      current = (current as (...args: unknown[]) => unknown).apply(
        receiver,
        step.args
      )
    }
  }
  return current
}

// Builds the chainable `db.rls` proxy. It records the get/apply chain lazily;
// only when the chain is awaited (`.then`/`.catch`/`.finally`) does it open an
// RLS transaction and replay the chain against that transaction's `tx`. Each
// awaited chain is its own transaction.
function createRlsProxy(
  runTransaction: (transaction: (tx: unknown) => unknown) => Promise<unknown>
): unknown {
  const build = (path: RlsChainStep[], isRoot: boolean): unknown => {
    // The proxy target must be callable so the `apply` trap fires for `()`.
    const target = () => undefined
    return new Proxy(target, {
      apply(_target, _thisArg, args: unknown[]) {
        if (isRoot) {
          throw new Error(
            "db.rls is chainable (e.g. db.rls.select().from(table)). Use db.rlsTransaction(cb) to run multiple statements in one RLS transaction."
          )
        }
        return build([...path, { args, kind: "apply" }], false)
      },
      get(_target, prop) {
        // Awaiting the chain triggers the transaction + replay. The transaction
        // is opened lazily when the promise method is *called* (not merely
        // accessed), so probing `.then` for thenable-detection never starts a
        // stray transaction. The call returns a real promise, so any further
        // `.then`/`.catch`/`.finally` chaining runs on it, not on the proxy.
        if (prop === "then" || prop === "catch" || prop === "finally") {
          return (...promiseArgs: unknown[]) => {
            const promise = runTransaction((tx) => replayRlsChain(tx, path))
            return (promise[prop] as (...args: unknown[]) => unknown).apply(
              promise,
              promiseArgs
            )
          }
        }
        // Ignore symbol probes (inspection, `Symbol.toPrimitive`, etc.) so they
        // are not recorded as part of the query chain.
        if (typeof prop === "symbol") {
          return
        }
        return build([...path, { kind: "get", prop }], false)
      },
    })
  }
  return build([], true)
}

async function resolveTokenClaims(
  authContext?: SupabaseAuthContext
): Promise<SupabaseTokenClaims> {
  if (isSupabaseClientLike(authContext)) {
    const { data, error } = await authContext.auth.getClaims()
    if (error) {
      throw error
    }
    return normalizeTokenClaims(data?.claims)
  }
  return normalizeTokenClaims(authContext)
}

function isSupabaseClientLike(
  authContext?: SupabaseAuthContext
): authContext is SupabaseAuthClientLike {
  return (
    !!authContext &&
    typeof authContext === "object" &&
    "auth" in authContext &&
    typeof authContext.auth === "object" &&
    !!authContext.auth &&
    "getClaims" in authContext.auth &&
    typeof authContext.auth.getClaims === "function"
  )
}

function normalizeTokenClaims(
  verifiedClaims?: SupabaseAuthContext
): SupabaseTokenClaims {
  if (
    !verifiedClaims ||
    typeof verifiedClaims !== "object" ||
    Array.isArray(verifiedClaims) ||
    isSupabaseClientLike(verifiedClaims)
  ) {
    return {}
  }
  return verifiedClaims
}
