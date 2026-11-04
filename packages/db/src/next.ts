import {
  type AuthError,
  isAuthRetryableFetchError,
  type JwtPayload,
  type SupabaseClient,
} from "@supabase/supabase-js"
import type { AnyRelations, EmptyRelations } from "drizzle-orm"
import { cache } from "react"
import {
  type CreateClientConfig,
  createSupabaseClient,
  type DrizzleClient,
} from "./clients.ts"
import {
  createDefineAction,
  createDefineFormAction,
  createDefineQuery,
  type DefineAction,
  type DefineFormAction,
  type DefineQuery,
} from "./define-action.ts"

// biome-ignore lint/performance/noBarrelFile: `/next` is the one entry server actions import; the result types and error class belong on it.
export {
  type ActionError,
  type ActionIssue,
  type ActionResult,
  FieldValidationError,
  toActionError,
  toFieldName,
} from "./action-result.ts"
export type {
  ActionContext,
  ActionDefinition,
  ActionHandler,
  ActionOptions,
  ActionSchema,
  ActionValue,
  ChangeDescription,
  ChangeValue,
  DefineAction,
  Defined,
  DefineFormAction,
  DefineQuery,
  DescribeChange,
  Described,
  FormActionDefinition,
  FormActionOptions,
  FormActionSchema,
  QueryDefinition,
  QueryOptions,
} from "./define-action.ts"

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

/** The only part of a Supabase client the request context reads. */
export type ClaimsSource = { auth: Pick<SupabaseClient["auth"], "getClaims"> }

/**
 * The part of a Supabase client `getBearerContext` reads: `getClaims` checks
 * the token's signature, `getUser` confirms its session with Auth.
 */
export type SessionSource = {
  auth: Pick<SupabaseClient["auth"], "getClaims" | "getUser">
}

/**
 * A verified request: the full `getClaims()` payload, the RLS client, and who
 * acts for the user (`null` when the user acts in person).
 */
export type RequestContext<TRelations extends AnyRelations = EmptyRelations> = {
  readonly claims: JwtPayload
  readonly db: DrizzleClient<TRelations>
  readonly via: string | null
}

/**
 * A request verified from its `Authorization: Bearer` token, issued by
 * Supabase Auth's OAuth server to a registered client.
 */
export type BearerContext<TRelations extends AnyRelations = EmptyRelations> =
  RequestContext<TRelations> & {
    /** The OAuth client the token was issued to, from its signed claims. */
    readonly clientId: string
    /** The raw access token, for a protocol layer that needs it (MCP's `authInfo`). */
    readonly token: string
    readonly via: string
  }

export type BearerOptions = {
  /**
   * Builds a Supabase client that holds no session, e.g. `createClient` from
   * `@supabase/supabase-js` with `auth: { persistSession: false }`.
   */
  supabase: () => SessionSource | Promise<SessionSource>
  /**
   * Resolves the token's `client_id` to the `app.via` label its writes carry
   * ("Claude"), or `null` or `undefined` for a client you did not register.
   * Supabase accepts a `resource` parameter but keeps `aud` at
   * `authenticated`, so `client_id` is what tells your registered clients
   * apart. An empty label refuses the client too.
   */
  client: (
    clientId: string
  ) => string | null | undefined | Promise<string | null | undefined>
  /**
   * Also confirms the session with Auth (`getUser`) on every call. A revoked
   * grant ends its refresh token at once, but its last access token still
   * passes `getClaims` until it expires. Costs one Auth round trip per call.
   * Default `false`.
   */
  confirmSession?: boolean
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
  /** Turns on `getBearerContext`, for callers that send a token, not cookies. */
  bearer?: BearerOptions
}

export type RequestDb<TRelations extends AnyRelations = EmptyRelations> = {
  /** Memoised per render: `{ claims, db, via: null }` for the verified caller. */
  getRequestContext: () => Promise<RequestContext<TRelations>>
  /**
   * The context of a caller that sends `Authorization: Bearer <token>`, such as
   * an MCP client. Needs the `bearer` option. Throws `UnauthenticatedError` for
   * a missing or invalid token, a token with no `sub`, a role other than
   * `authenticated` or no `client_id`, a client `bearer.client` refuses and,
   * with `confirmSession`, an ended session. Not memoised: call it once per
   * request.
   */
  getBearerContext: (request: Request) => Promise<BearerContext<TRelations>>
  /**
   * The same caller, acting through `via` ("AI assistant"): every transaction
   * of the returned `db` sets `app.via`.
   */
  withVia: <TContext extends RequestContext<TRelations>>(
    context: TContext,
    via: string
  ) => TContext
  /** The common case: just the RLS-bound client. */
  getRequestDb: () => Promise<DrizzleClient<TRelations>>
  /** Wraps a handler into a `"use server"` export; see `DefineAction`. */
  defineAction: DefineAction<RequestContext<TRelations>>
  /**
   * `defineAction` for a read served by a query route (`createQueryRoute` from
   * `@zeno-lib/query/query-route`) instead of a server action. Export it from a
   * module **without** `"use server"`, so the browser can run several at once.
   */
  defineQuery: DefineQuery<RequestContext<TRelations>>
  /**
   * `defineAction` for forms: resolves to an `ActionResult` instead of
   * throwing on invalid input; see `DefineFormAction`.
   */
  defineFormAction: DefineFormAction<RequestContext<TRelations>>
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
  const { bearer, connectionString, supabase, ...config } = options

  const createDb = (
    claims: JwtPayload,
    via: string | null,
    readOnly = false
  ) => {
    const url =
      typeof connectionString === "function"
        ? connectionString()
        : connectionString
    return createSupabaseClient<TRelations>(claims, {
      ...config,
      ...(url === undefined ? {} : { connectionString: url }),
      ...(via === null ? {} : { via }),
      ...(readOnly ? { readOnly } : {}),
    })
  }
  const readOnlyContext = <TContext extends RequestContext<TRelations>>(
    context: TContext
  ): TContext => ({
    ...context,
    db: createDb(context.claims, context.via, true),
  })

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

      return { claims: data.claims, db: createDb(data.claims, null), via: null }
    }
  )

  const getBearerContext = async (
    request: Request
  ): Promise<BearerContext<TRelations>> => {
    if (!bearer) {
      throw new Error(
        "getBearerContext needs the `bearer` option of createRequestDb"
      )
    }
    const authorization = request.headers.get("authorization") ?? ""
    const token = BEARER_SCHEME.test(authorization)
      ? authorization.replace(BEARER_SCHEME, "")
      : ""
    if (!token || WHITESPACE.test(token)) {
      throw new UnauthenticatedError(
        "Unauthorized: no bearer token on this request"
      )
    }

    const client = await bearer.supabase()
    const claims = await verifyToken(client, token)
    // `createSupabaseClient` would run any other role as `anon`.
    if (claims.role !== "authenticated") {
      throw new UnauthenticatedError(
        "Unauthorized: the token's role is not authenticated"
      )
    }
    const clientId = claims.client_id
    if (typeof clientId !== "string" || !clientId) {
      throw new UnauthenticatedError(
        "Unauthorized: the token was not issued to an OAuth client"
      )
    }
    const via = await bearer.client(clientId)
    if (!via) {
      throw new UnauthenticatedError(
        "Unauthorized: the token's OAuth client is not registered"
      )
    }
    if (bearer.confirmSession) {
      await confirmSession(client, token, claims.sub)
    }

    return { claims, clientId, db: createDb(claims, via), token, via }
  }

  return {
    defineAction: createDefineAction(getRequestContext, readOnlyContext),
    defineFormAction: createDefineFormAction(
      getRequestContext,
      readOnlyContext
    ),
    defineQuery: createDefineQuery(getRequestContext, readOnlyContext),
    getBearerContext,
    getRequestContext,
    getRequestDb: async () => (await getRequestContext()).db,
    withVia: (context, via) => ({
      ...context,
      db: createDb(context.claims, via),
      via,
    }),
  }
}

// RFC 6750's header form, `Bearer <token>`. The scheme is case-insensitive
// (RFC 9110), and the token has no whitespace.
const BEARER_SCHEME = /^Bearer +/iu
const WHITESPACE = /\s/u

// Auth or the JWKS could not answer, or asked to slow down: a server failure
// the caller should see as one, not a bad token that sends the client back to
// sign in.
function isServerFailure(error: AuthError): boolean {
  const status = error.status ?? 0
  return isAuthRetryableFetchError(error) || status === 429 || status >= 500
}

async function verifyToken(
  client: SessionSource,
  token: string
): Promise<JwtPayload & { sub: string }> {
  let result: Awaited<ReturnType<SessionSource["auth"]["getClaims"]>>
  try {
    result = await client.auth.getClaims(token)
  } catch (error) {
    // `getClaims` returns Auth's and the JWKS's failures, and throws only on
    // the token itself: parts that are not JSON, an `alg` it cannot verify,
    // a key that does not fit it.
    throw new UnauthenticatedError("Unauthorized: invalid bearer token", {
      cause: error,
    })
  }

  if (result.error) {
    if (isServerFailure(result.error)) {
      throw result.error
    }
    throw new UnauthenticatedError("Unauthorized: invalid bearer token", {
      cause: result.error,
    })
  }
  const claims = result.data?.claims
  if (!claims?.sub) {
    throw new UnauthenticatedError()
  }
  return claims as JwtPayload & { sub: string }
}

async function confirmSession(
  client: SessionSource,
  token: string,
  sub: string
): Promise<void> {
  const { data, error } = await client.auth.getUser(token)
  if (error) {
    if (isServerFailure(error)) {
      throw error
    }
    throw new UnauthenticatedError("Unauthorized: the session has ended", {
      cause: error,
    })
  }
  if (data.user.id !== sub) {
    throw new UnauthenticatedError("Unauthorized: the session has ended")
  }
}
