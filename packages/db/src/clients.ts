// https://orm.drizzle.team/docs/rls#using-with-supabase
import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import type { AnyRelations, EmptyRelations } from "drizzle-orm"
import { sql } from "drizzle-orm"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import { createRlsQueryClient } from "./rls-query-client.ts"

// `set local role <ident>` can't be parameterized, so the role is interpolated
// via sql.raw. Restrict it to the Supabase-managed roles so a forged `role`
// claim can't inject SQL or switch into the service role.
const ALLOWED_RLS_ROLES = new Set(["anon", "authenticated"])

export type CreateAdminDrizzleOptions<
  TRelations extends AnyRelations = EmptyRelations,
> = {
  // Only used as the pool-cache key (object identity); not passed to drizzle —
  // drizzle v1 derives the relational query API from `relations`, not `schema`.
  // Pair a stable `schema` object with a stable `relations` object so the cached
  // pools are reused.
  schema: Record<string, unknown>
  relations?: TRelations
  connectionString?: string
}

export type CreateSupabaseDrizzleOptions<
  TRelations extends AnyRelations = EmptyRelations,
> = CreateAdminDrizzleOptions<TRelations> & {
  // Mandatory: queries resolve verified claims via `supabase.auth.getClaims()`.
  // Raw tokens/claims are intentionally not accepted — JWT verification belongs
  // to Supabase Auth.
  supabase: SupabaseClient
}

// Relations are erased to `AnyRelations` inside the cache; each factory casts
// back to its caller's `TRelations` at the point of return.
type DrizzleClient = PostgresJsDatabase<AnyRelations>
type PoolEndOptions = Parameters<ReturnType<typeof postgres>["end"]>[0]

// The two pools' drizzle clients, shared by every handle on the same schema +
// connection url. `end` closes both underlying pools.
type PooledClients = {
  adminClient: DrizzleClient
  rlsClient: DrizzleClient
  end: (options?: PoolEndOptions) => Promise<void>
}

// Cached pools are reference-counted so a request-scoped `close()` only ends the
// underlying pools once the last handle sharing them is closed.
type SharedEntry = { clients: PooledClients; refCount: number }

const sharedClients = new WeakMap<
  Record<string, unknown>,
  Map<string, SharedEntry>
>()

// RLS-aware client. Query it directly as the signed-in Supabase user:
// `db.select().from(table)` / `db.query.table.findMany()` run each statement
// inside its own RLS transaction (claims resolved from the bound Supabase
// client, role switched). `db.transaction(cb)` runs several statements under
// one atomic RLS transaction. `supabase` is mandatory.
export function createSupabaseDrizzle<
  TRelations extends AnyRelations = EmptyRelations,
>(options: CreateSupabaseDrizzleOptions<TRelations>) {
  const url = resolveDatabaseUrl(options)
  const entry = acquireSharedClients(options.schema, url, options.relations)
  const close = createCloseHandle(options.schema, url, entry)
  const runTransaction = createRlsTransactionRunner(
    entry.clients.rlsClient,
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
  TRelations extends AnyRelations = EmptyRelations,
>(options: CreateAdminDrizzleOptions<TRelations>) {
  const url = resolveDatabaseUrl(options)
  const entry = acquireSharedClients(options.schema, url, options.relations)
  const close = createCloseHandle(options.schema, url, entry)

  return attachClose(
    entry.clients.adminClient,
    close
  ) as unknown as PostgresJsDatabase<TRelations> & {
    close: typeof close
  }
}

function resolveDatabaseUrl(options: { connectionString?: string }): string {
  const url = options.connectionString ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable")
  }
  return url
}

// prepare:false → required for the Supabase transaction pooler (port 6543).
// Two separate pools: admin runs as the connection role (bypasses RLS), rls
// switches role + sets JWT claims per transaction. Pools connect lazily, so the
// one a given factory doesn't use never opens a connection. `relations` enables
// the relational query API on both clients (and inside the rls tx).
function createPooledClients(
  url: string,
  relations: AnyRelations | undefined
): PooledClients {
  const adminPool = postgres(url, { prepare: false })
  const rlsPool = postgres(url, { prepare: false })
  return {
    adminClient: drizzle({ client: adminPool, relations }),
    async end(options) {
      await Promise.all([adminPool.end(options), rlsPool.end(options)])
    },
    rlsClient: drizzle({ client: rlsPool, relations }),
  }
}

// Per-Supabase-client transaction runner: resolves the verified auth context,
// then switches role + installs the JWT claims for the duration of each
// transaction so RLS applies.
function createRlsTransactionRunner(
  rlsClient: DrizzleClient,
  supabase: SupabaseClient
) {
  return (async (transaction, txConfig) => {
    const { claims, role, sub } = await resolveAuthContext(supabase)
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
}

// Resolves verified claims from Supabase and clamps them to a safe RLS context.
async function resolveAuthContext(supabase: SupabaseClient) {
  const token = await resolveClaims(supabase)
  const sub = token?.sub ?? ""
  const role =
    token?.role && ALLOWED_RLS_ROLES.has(token.role) ? token.role : "anon"
  // Force the serialized claims' role to match the role we actually `set local
  // role` to, so a policy reading auth.jwt()->>'role' can never see a value that
  // disagrees with the live Postgres role (e.g. a service_role claim downgraded
  // to anon).
  const claims = JSON.stringify({ ...token, role })
  return { claims, role, sub }
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

// Returns the cached pools for this schema + url, creating them on first use and
// bumping the reference count for every handle that shares them.
function acquireSharedClients(
  schema: Record<string, unknown>,
  url: string,
  relations: AnyRelations | undefined
): SharedEntry {
  let schemaClients = sharedClients.get(schema)
  if (!schemaClients) {
    schemaClients = new Map()
    sharedClients.set(schema, schemaClients)
  }

  const existing = schemaClients.get(url)
  if (existing) {
    existing.refCount += 1
    return existing
  }

  const entry: SharedEntry = {
    clients: createPooledClients(url, relations),
    refCount: 1,
  }
  schemaClients.set(url, entry)
  return entry
}

// Reference-counted release of a handle's share of the cached pools. Guards
// against double-close: each handle releases its reference at most once, and the
// pools are only ended once the last handle closes.
function createCloseHandle(
  schema: Record<string, unknown>,
  url: string,
  entry: SharedEntry
) {
  let released = false
  return async (closeOptions?: PoolEndOptions): Promise<void> => {
    if (released) {
      return
    }
    released = true
    entry.refCount -= 1
    // Other handles still share these pools — leave them open.
    if (entry.refCount > 0) {
      return
    }
    sharedClients.get(schema)?.delete(url)
    await entry.clients.end(closeOptions)
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
