import type { JwtPayload, SupabaseClient } from "@supabase/supabase-js"
import type { AnyRelations, EmptyRelations } from "drizzle-orm"
import { cache } from "react"
import {
  type CreateClientConfig,
  createSupabaseClient,
  type DrizzleClient,
} from "./clients.ts"
import { createDefineAction, type DefineAction } from "./define-action.ts"

export type {
  ActionContext,
  ActionHandler,
  ActionSchema,
  DefineAction,
} from "./define-action.ts"

/**
 * Thrown when a request carries no verified session. A named class so a caller
 * with a legitimate answer for that case (a permission check, where "not signed
 * in" means "no") can tell it apart from a real failure with `instanceof`.
 */
export class UnauthenticatedError extends Error {
  constructor(message = "Unauthorized: no verified session on this request") {
    super(message)
    this.name = "UnauthenticatedError"
  }
}

/** The only part of a Supabase client the request context reads. */
export type ClaimsSource = { auth: Pick<SupabaseClient["auth"], "getClaims"> }

/** A verified request: the full `getClaims()` payload and the RLS client. */
export type RequestContext<TRelations extends AnyRelations = EmptyRelations> = {
  readonly claims: JwtPayload
  readonly db: DrizzleClient<TRelations>
}

export type CreateRequestDbOptions<
  TRelations extends AnyRelations = EmptyRelations,
> = Omit<CreateClientConfig<TRelations>, "connectionString"> & {
  /**
   * Builds the request's Supabase client, e.g. `createClient` from
   * `@zeno-lib/supabase/next-server` (cookie session via `next/headers`).
   */
  supabase: () => ClaimsSource | Promise<ClaimsSource>
  /**
   * Overrides `SUPABASE_DATABASE_URL`. A function is resolved per request, not
   * at import, so a build without server secrets can still import the module.
   */
  connectionString?: string | (() => string)
}

export type RequestDb<TRelations extends AnyRelations = EmptyRelations> = {
  /** Memoised per render: `{ claims, db }` for the verified caller. */
  getRequestContext: () => Promise<RequestContext<TRelations>>
  /** The common case: just the RLS-bound client. */
  getRequestDb: () => Promise<DrizzleClient<TRelations>>
  /** Wraps a handler into a `"use server"` export; see `DefineAction`. */
  defineAction: DefineAction<RequestContext<TRelations>>
}

/**
 * Request-scoped, RLS-bound Drizzle access for Next.js. Verifies the session
 * with `getClaims()` (which checks the signature) and installs the **whole**
 * claims object, so custom claims reach `auth.jwt()` in policies. There is no
 * fallback to `anon`: a caller without a verified `sub` gets
 * `UnauthenticatedError` rather than the empty result of a policy it never
 * satisfied.
 *
 * `getRequestContext` is wrapped in React's `cache`, so one server render shares
 * one verification and one handle. A server action invoked from the browser
 * runs outside a render and resolves afresh on every call.
 *
 * Do not `close()` the handle: pools are shared and reference-counted.
 */
export function createRequestDb<
  TRelations extends AnyRelations = EmptyRelations,
>(options: CreateRequestDbOptions<TRelations>): RequestDb<TRelations> {
  const { connectionString, supabase, ...config } = options

  const getRequestContext = cache(
    async (): Promise<RequestContext<TRelations>> => {
      const client = await supabase()
      const { data, error } = await client.auth.getClaims()

      if (error) {
        throw error
      }
      if (!data?.claims.sub) {
        throw new UnauthenticatedError()
      }

      const url =
        typeof connectionString === "function"
          ? connectionString()
          : connectionString
      const db = createSupabaseClient<TRelations>(
        data.claims,
        url === undefined ? config : { ...config, connectionString: url }
      )

      return { claims: data.claims, db }
    }
  )

  return {
    defineAction: createDefineAction(getRequestContext),
    getRequestContext,
    getRequestDb: async () => (await getRequestContext()).db,
  }
}
