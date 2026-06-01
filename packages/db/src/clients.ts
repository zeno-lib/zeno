// https://orm.drizzle.team/docs/rls#using-with-supabase
import { type DrizzleConfig, sql } from "drizzle-orm"
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
> = {
  schema: TSchema
  connectionString?: string
  casing?: DrizzleConfig<TSchema>["casing"]
}

export type CreateSupabaseDrizzleOptions<
  TSchema extends Record<string, unknown>,
> = CreateDrizzleClientsOptions<TSchema> & {
  supabase?: SupabaseAuthContext
}

type DrizzleClients<TSchema extends Record<string, unknown>> = ReturnType<
  typeof createDrizzleClients<TSchema>
>

const sharedClients = new WeakMap<
  Record<string, unknown>,
  Map<string, DrizzleClients<Record<string, unknown>>>
>()

export function createDrizzleClients<TSchema extends Record<string, unknown>>(
  options: CreateDrizzleClientsOptions<TSchema>
) {
  const url = options.connectionString ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable")
  }

  const config = {
    casing: options.casing,
    schema: options.schema,
  } satisfies DrizzleConfig<TSchema>

  // prepare:false → required for the Supabase transaction pooler (port 6543).
  // Two separate pools: admin runs as the connection role (bypasses RLS),
  // rls switches role + sets JWT claims per transaction.
  const adminPool = postgres(url, { prepare: false })
  const rlsPool = postgres(url, { prepare: false })
  const adminClient = drizzle({
    client: adminPool,
    ...config,
  })
  const rlsClient = drizzle({
    client: rlsPool,
    ...config,
  })

  // Bypasses RLS. Use for webhooks, admin tasks, background jobs, seeding.
  function getDrizzleSupabaseAdminClient(): PostgresJsDatabase<TSchema> {
    return adminClient
  }

  // RLS-aware. Pass either a Supabase client (preferred) or verified JWT
  // claims; every query MUST run inside `runTransaction` for the JWT context
  // (and thus RLS) to apply.
  function getDrizzleSupabaseClient(authContext?: SupabaseAuthContext) {
    const runTransaction = (async (transaction, txConfig) =>
      await rlsClient.transaction(async (tx) => {
        const token = await resolveTokenClaims(authContext)
        const claims = JSON.stringify(token)
        const sub = token.sub ?? ""
        const role =
          token.role && ALLOWED_RLS_ROLES.has(token.role) ? token.role : "anon"

        // auth.jwt()/auth.uid() read these; is_local scopes them to the tx, so
        // they auto-reset when it commits or rolls back.
        await tx.execute(
          sql`select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${sub}, true)`
        )
        await tx.execute(sql`set local role ${sql.raw(role)}`)
        return await transaction(tx)
      }, txConfig)) as typeof rlsClient.transaction

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

export function createSupabaseDrizzle<TSchema extends Record<string, unknown>>(
  options: CreateSupabaseDrizzleOptions<TSchema>
) {
  const {
    closeDrizzleSupabaseClients,
    getDrizzleSupabaseAdminClient,
    getDrizzleSupabaseClient,
  } = getSharedDrizzleClients(options)
  const cacheKey = createCacheKey(options)
  type RlsTransaction = ReturnType<
    typeof getDrizzleSupabaseClient
  >["runTransaction"]
  const rls =
    options.supabase === undefined
      ? ((() =>
          Promise.reject(
            new Error(
              "Missing Supabase client for RLS. Pass { supabase } to createSupabaseDrizzle()."
            )
          )) as RlsTransaction)
      : getDrizzleSupabaseClient(options.supabase).runTransaction

  return {
    admin: getDrizzleSupabaseAdminClient(),
    close: async (
      closeOptions?: Parameters<typeof closeDrizzleSupabaseClients>[0]
    ) => {
      sharedClients.get(options.schema)?.delete(cacheKey)
      await closeDrizzleSupabaseClients(closeOptions)
    },
    rls,
  }
}

function getSharedDrizzleClients<TSchema extends Record<string, unknown>>(
  options: CreateDrizzleClientsOptions<TSchema>
): DrizzleClients<TSchema> {
  const cacheKey = createCacheKey(options)
  let schemaClients = sharedClients.get(options.schema)
  if (!schemaClients) {
    schemaClients = new Map()
    sharedClients.set(options.schema, schemaClients)
  }

  const existingClients = schemaClients.get(cacheKey) as
    | DrizzleClients<TSchema>
    | undefined
  if (existingClients) {
    return existingClients
  }

  const clients = createDrizzleClients(options)
  schemaClients.set(
    cacheKey,
    clients as DrizzleClients<Record<string, unknown>>
  )
  return clients
}

function createCacheKey<TSchema extends Record<string, unknown>>(
  options: CreateDrizzleClientsOptions<TSchema>
): string {
  const url = options.connectionString ?? process.env.DATABASE_URL
  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable")
  }
  return JSON.stringify({ casing: options.casing ?? null, url })
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
