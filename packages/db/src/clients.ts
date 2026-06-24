// https://orm.drizzle.team/docs/rls#using-with-supabase
import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import type { AnyRelations, EmptyRelations } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

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

// Admin (RLS-bypassing) factory needs no auth context.
export type CreateAdminDrizzleOptions<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
> = CreateDrizzleClientsOptions<TSchema, TRelations>

export type CreateSupabaseDrizzleOptions<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
> = CreateDrizzleClientsOptions<TSchema, TRelations> & {
  // Mandatory: queries resolve verified claims via `supabase.auth.getClaims()`.
  // Raw tokens/claims are intentionally not accepted — JWT verification belongs
  // to Supabase Auth.
  supabase: SupabaseClient
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
  // rls switches role + sets JWT claims per transaction. Pools connect lazily,
  // so the one a given factory doesn't use never opens a connection.
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

  // RLS-aware. Resolves verified JWT claims from the Supabase client; every
  // query MUST run inside `runTransaction` for the JWT context (and thus RLS)
  // to apply.
  function getDrizzleSupabaseClient(supabase: SupabaseClient) {
    const runTransaction = (async (transaction, txConfig) => {
      const token = await resolveClaims(supabase)
      const sub = token?.sub ?? ""
      const role =
        token?.role && ALLOWED_RLS_ROLES.has(token.role) ? token.role : "anon"
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

// RLS-aware client. Query it directly as the signed-in Supabase user:
// `db.select().from(table)` / `db.query.table.findMany()` run each statement
// inside its own RLS transaction (claims resolved from the bound Supabase
// client, role switched). `db.transaction(cb)` runs several statements under
// one atomic RLS transaction. `supabase` is mandatory.
export function createSupabaseDrizzle<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(options: CreateSupabaseDrizzleOptions<TSchema, TRelations>) {
  const cacheKey = createCacheKey(options)
  const entry = acquireSharedDrizzleClients(options, cacheKey)
  const close = createCloseHandle(options.schema, cacheKey, entry)
  const { runTransaction } = entry.clients.getDrizzleSupabaseClient(
    options.supabase
  )

  return createRlsQueryClient(
    runTransaction as (
      transaction: (tx: unknown) => unknown
    ) => Promise<unknown>,
    close
  ) as PostgresJsDatabase<TRelations> & { close: typeof close }
}

// Admin client. Query it directly to bypass RLS (webhooks, admin tasks,
// background jobs, seeding). Needs no Supabase client — it connects with
// `DATABASE_URL` (or the `connectionString` override).
export function createAdminDrizzle<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(options: CreateAdminDrizzleOptions<TSchema, TRelations>) {
  const cacheKey = createCacheKey(options)
  const entry = acquireSharedDrizzleClients(options, cacheKey)
  const close = createCloseHandle(options.schema, cacheKey, entry)
  const adminClient = entry.clients.getDrizzleSupabaseAdminClient()

  return attachClose(adminClient, close) as PostgresJsDatabase<TRelations> & {
    close: typeof close
  }
}

// Reference-counted release of a handle's share of the cached pools. Guards
// against double-close: each handle releases its reference at most once, and
// the pools are only ended once the last handle closes.
function createCloseHandle<
  TSchema extends Record<string, unknown>,
  TRelations extends AnyRelations = EmptyRelations,
>(
  schema: TSchema,
  cacheKey: string,
  entry: { clients: DrizzleClients<TSchema, TRelations>; refCount: number }
) {
  let released = false
  return async (
    closeOptions?: Parameters<
      DrizzleClients<TSchema, TRelations>["closeDrizzleSupabaseClients"]
    >[0]
  ): Promise<void> => {
    if (released) {
      return
    }
    released = true
    entry.refCount -= 1
    // Other handles still share these pools — leave them open.
    if (entry.refCount > 0) {
      return
    }
    sharedClients.get(schema)?.delete(cacheKey)
    await entry.clients.closeDrizzleSupabaseClients(closeOptions)
  }
}

// Wraps a drizzle client so `db.close()` releases the cached pools while every
// other property/method forwards to the real client (bound so drizzle's `this`
// — including private fields — keeps working). `close` does not collide with
// any `PostgresJsDatabase` member.
function attachClose<T extends object, TClose>(client: T, close: TClose): T {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === "close") {
        return close
      }
      const value = Reflect.get(target, prop, receiver)
      return typeof value === "function" ? value.bind(target) : value
    },
  })
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

// One recorded step of a chained call: `db.select` is a get, the following `()`
// is an apply.
type AsUserChainStep =
  | { kind: "get"; prop: PropertyKey }
  | { kind: "apply"; args: unknown[] }

// Walk the recorded chain against the live transaction `tx`, tracking the
// receiver so methods are invoked with the right `this`. Returns whatever the
// chain produces — a thenable drizzle builder, or a relational query promise.
function replayAsUserChain(tx: unknown, path: AsUserChainStep[]): unknown {
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

const PROMISE_METHODS = new Set<PropertyKey>(["then", "catch", "finally"])

// Awaiting a recorded chain triggers the transaction + replay. The transaction
// is opened lazily when the promise method is *called* (not merely accessed),
// so probing `.then` for thenable-detection never starts a stray transaction.
// The call returns a real promise, so any further `.then`/`.catch`/`.finally`
// chaining runs on it.
function replayPromiseMethod(
  prop: PropertyKey,
  path: AsUserChainStep[],
  runTransaction: (transaction: (tx: unknown) => unknown) => Promise<unknown>
) {
  return (...promiseArgs: unknown[]) => {
    const promise = runTransaction((tx) => replayAsUserChain(tx, path))
    return (
      promise[prop as keyof Promise<unknown>] as (...args: unknown[]) => unknown
    ).apply(promise, promiseArgs)
  }
}

// Builds the RLS query client returned by `createSupabaseDrizzle`. Querying it
// records the get/apply chain lazily; only when the chain is awaited
// (`.then`/`.catch`/`.finally`) does it open an RLS transaction and replay the
// chain against that transaction's `tx`. Each awaited chain is its own
// transaction. `db.transaction(cb)` runs several statements in one transaction,
// and `db.close()` releases the pools. The root itself is intentionally not
// thenable and not callable.
function createRlsQueryClient(
  runTransaction: (transaction: (tx: unknown) => unknown) => Promise<unknown>,
  close: (...args: never[]) => Promise<void>
): unknown {
  const build = (path: AsUserChainStep[], isRoot: boolean): unknown => {
    // The proxy target must be callable so the `apply` trap fires for `()`.
    const target = () => undefined
    return new Proxy(target, {
      apply(_target, _thisArg, args: unknown[]) {
        if (isRoot) {
          throw new Error(
            "The createSupabaseDrizzle() client is queried directly (e.g. db.select().from(table)). Use db.transaction(cb) to run multiple statements in one RLS transaction."
          )
        }
        return build([...path, { args, kind: "apply" }], false)
      },
      get(_target, prop) {
        // Multi-statement RLS transaction and pool release live on the root.
        if (isRoot && prop === "transaction") {
          return runTransaction
        }
        if (isRoot && prop === "close") {
          return close
        }
        if (PROMISE_METHODS.has(prop)) {
          // Root stays a plain (non-thenable) object so `await db` / probes
          // never open a stray transaction; recorded chains are awaitable.
          return isRoot
            ? undefined
            : replayPromiseMethod(prop, path, runTransaction)
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

async function resolveClaims(
  supabase: SupabaseClient
): Promise<JwtPayload | undefined> {
  const { data, error } = await supabase.auth.getClaims()
  if (error) {
    throw error
  }
  return data?.claims
}
