// https://orm.drizzle.team/docs/rls#using-with-supabase
import { type DrizzleConfig, sql } from "drizzle-orm"
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js"
import postgres from "postgres"

// Claims we read off the decoded Supabase JWT to drive RLS.
type SupabaseTokenClaims = {
  sub?: string
  role?: string
}

// `set local role <ident>` can't be parameterized, so the role is interpolated
// via sql.raw. Restrict it to the Supabase-managed roles so a forged `role`
// claim can't inject SQL.
const ALLOWED_ROLES = new Set(["anon", "authenticated", "service_role"])

type CreateDrizzleClientsOptions<TSchema extends Record<string, unknown>> = {
  schema: TSchema
  connectionString?: string
  casing?: DrizzleConfig<TSchema>["casing"]
}

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
  const adminClient = drizzle({
    client: postgres(url, { prepare: false }),
    ...config,
  })
  const rlsClient = drizzle({
    client: postgres(url, { prepare: false }),
    ...config,
  })

  // Bypasses RLS. Use for webhooks, admin tasks, background jobs, seeding.
  function getDrizzleSupabaseAdminClient(): PostgresJsDatabase<TSchema> {
    return adminClient
  }

  // RLS-aware. Pass the request's Supabase `access_token`; every query MUST run
  // inside `runTransaction` for the JWT context (and thus RLS) to apply.
  function getDrizzleSupabaseClient(accessToken: string) {
    const token = decodeJwt(accessToken)
    const claims = JSON.stringify(token)
    const sub = token.sub ?? ""
    const role =
      token.role && ALLOWED_ROLES.has(token.role) ? token.role : "anon"

    const runTransaction = (async (transaction, txConfig) =>
      await rlsClient.transaction(async (tx) => {
        try {
          // auth.jwt()/auth.uid() read these; is_local scopes them to the tx,
          // so they auto-reset when it commits or rolls back.
          await tx.execute(
            sql`select set_config('request.jwt.claims', ${claims}, true), set_config('request.jwt.claim.sub', ${sub}, true)`
          )
          await tx.execute(sql`set local role ${sql.raw(role)}`)
          return await transaction(tx)
        } finally {
          // Defensive reset (transaction-local settings already auto-reset).
          await tx.execute(
            sql`select set_config('request.jwt.claims', NULL, true), set_config('request.jwt.claim.sub', NULL, true)`
          )
          await tx.execute(sql`reset role`)
        }
      }, txConfig)) as typeof rlsClient.transaction

    return { runTransaction }
  }

  return { getDrizzleSupabaseAdminClient, getDrizzleSupabaseClient }
}

// Supabase already verified the token; we only need to read its claims.
// Hand-rolled to avoid a jwt-decode dependency (server-only; Buffer is fine).
function decodeJwt(accessToken: string): SupabaseTokenClaims {
  try {
    const payload = accessToken.split(".")[1]
    if (!payload) {
      return {}
    }
    return JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as SupabaseTokenClaims
  } catch {
    return {}
  }
}
