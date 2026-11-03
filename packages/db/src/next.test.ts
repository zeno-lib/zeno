import {
  AuthApiError,
  AuthError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  type JwtPayload,
  type User,
} from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { FieldValidationError } from "./action-result.ts"
import {
  type ActionContext,
  createDefineAction as bindAction,
  createDefineFormAction as bindFormAction,
  createDefineQuery as bindQuery,
} from "./define-action.ts"
import {
  type BearerOptions,
  type ClaimsSource,
  createRequestDb,
  type SessionSource,
  UnauthenticatedError,
} from "./next.ts"

// No database: the RLS client factory is replaced by a stub that returns a
// marker object, so nothing here builds a pool or opens a connection. What
// that client does with the claims is covered by test/rls.integration.test.ts.
const { createSupabaseClientMock } = vi.hoisted(() => ({
  createSupabaseClientMock: vi.fn((receivedClaims: unknown) => ({
    claims: receivedClaims,
    fake: true,
  })),
}))

vi.mock("./clients.ts", () => ({
  createSupabaseClient: createSupabaseClientMock,
}))

const claims: JwtPayload = {
  aal: "aal1",
  aud: "authenticated",
  exp: 0,
  iat: 0,
  iss: "test",
  role: "authenticated",
  roles: ["admin"],
  session_id: "session",
  sub: "11111111-1111-1111-1111-111111111111",
}

type GetClaimsResult = Awaited<ReturnType<ClaimsSource["auth"]["getClaims"]>>

function getClaimsResult(
  payload: JwtPayload | null,
  error: AuthError | null
): GetClaimsResult {
  if (payload) {
    return {
      data: {
        claims: payload,
        header: { alg: "HS256", kid: "test", typ: "JWT" },
        signature: new Uint8Array(),
      },
      error: null,
    }
  }
  return error ? { data: null, error } : { data: null, error: null }
}

function supabaseReturning(result: GetClaimsResult): () => ClaimsSource {
  return () => ({ auth: { getClaims: () => Promise.resolve(result) } })
}

beforeEach(() => {
  createSupabaseClientMock.mockClear()
})

// The builders with a read-only twin that changes nothing, for the tests that
// are not about it.
const asIs = <TContext>(context: TContext) => context
const createDefineAction = <TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>
) => bindAction(getContext, asIs)
const createDefineFormAction = <TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>
) => bindFormAction(getContext, asIs)
const createDefineQuery = <TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>
) => bindQuery(getContext, asIs)

describe("defineAction", () => {
  const schema = z.object({ id: z.number().int().positive() }).strict()

  it("parses the input, then calls the handler with db, parsed input and context", async () => {
    const context = { claims: { sub: "user-1" }, db: { name: "db" } }
    const getContext = vi.fn(() => Promise.resolve(context))
    const handler = vi.fn((db: { name: string }, input: { id: number }) =>
      Promise.resolve(`${db.name}:${input.id}`)
    )

    const action = createDefineAction(getContext)(schema, handler)

    await expect(action({ id: 7 })).resolves.toBe("db:7")
    expect(handler).toHaveBeenCalledWith(context.db, { id: 7 }, context)
  })

  it("resolves to null when the handler resolves to undefined", async () => {
    const action = createDefineAction(() => Promise.resolve({ db: {} }))(
      schema,
      () => Promise.resolve(undefined)
    )

    await expect(action({ id: 1 })).resolves.toBeNull()
  })

  it("keeps a falsy result other than undefined", async () => {
    const define = createDefineAction(() => Promise.resolve({ db: {} }))

    await expect(define(schema, () => 0)({ id: 1 })).resolves.toBe(0)
    await expect(define(schema, () => false)({ id: 1 })).resolves.toBe(false)
    await expect(define(schema, () => "")({ id: 1 })).resolves.toBe("")
  })

  it("hands the handler the claims for authorship", async () => {
    const context = { claims: { sub: "user-1" }, db: {} }
    const action = createDefineAction(() => Promise.resolve(context))(
      schema,
      (_db, input, { claims: { sub } }) => ({ createdBy: sub, ...input })
    )

    await expect(action({ id: 1 })).resolves.toEqual({
      createdBy: "user-1",
      id: 1,
    })
  })

  it("rejects invalid input before resolving the context or calling the handler", async () => {
    const getContext = vi.fn(() => Promise.resolve({ db: {} }))
    const handler = vi.fn()
    const action = createDefineAction(getContext)(schema, handler)

    await expect(action({ id: -1 })).rejects.toBeInstanceOf(z.ZodError)
    expect(getContext).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
  })

  it("propagates a context failure without calling the handler", async () => {
    const handler = vi.fn()
    const action = createDefineAction(() =>
      Promise.reject(new UnauthenticatedError())
    )(schema, handler)

    await expect(action({ id: 1 })).rejects.toBeInstanceOf(UnauthenticatedError)
    expect(handler).not.toHaveBeenCalled()
  })
})

describe("defineFormAction", () => {
  const schema = z.object({
    owners: z.array(
      z.object({ percentage: z.number().max(100, "At most 100") })
    ),
  })
  const context = { claims: { sub: "user-1" }, db: { name: "db" } }

  it("resolves to { ok: true, data } with the handler's result", async () => {
    const handler = vi.fn(
      (_db: { name: string }, input: z.output<typeof schema>) =>
        Promise.resolve(input.owners.length)
    )
    const action = createDefineFormAction(() => Promise.resolve(context))(
      schema,
      handler
    )

    await expect(action({ owners: [{ percentage: 50 }] })).resolves.toEqual({
      data: 1,
      ok: true,
    })
    expect(handler).toHaveBeenCalledWith(
      context.db,
      { owners: [{ percentage: 50 }] },
      context
    )
  })

  it("returns schema issues keyed by field name, before resolving the context", async () => {
    const getContext = vi.fn(() => Promise.resolve(context))
    const handler = vi.fn()
    const action = createDefineFormAction(getContext)(schema, handler)

    await expect(
      action({ owners: [{ percentage: 10 }, { percentage: 150 }] })
    ).resolves.toEqual({
      error: {
        fieldErrors: { "owners[1].percentage": ["At most 100"] },
        formErrors: [],
      },
      ok: false,
    })
    expect(getContext).not.toHaveBeenCalled()
    expect(handler).not.toHaveBeenCalled()
  })

  it("returns a FieldValidationError thrown by the handler in the same shape", async () => {
    const action = createDefineFormAction(() => Promise.resolve(context))(
      schema,
      () => {
        throw new FieldValidationError(
          { "owners[0].percentage": "Already allocated" },
          { formErrors: "Record is locked" }
        )
      }
    )

    await expect(action({ owners: [{ percentage: 1 }] })).resolves.toEqual({
      error: {
        fieldErrors: { "owners[0].percentage": ["Already allocated"] },
        formErrors: ["Record is locked"],
      },
      ok: false,
    })
  })

  it("keeps a failure that is not a validation error throwing", async () => {
    const boom = new Error("connection reset")
    const action = createDefineFormAction(() => Promise.resolve(context))(
      schema,
      () => Promise.reject(boom)
    )

    await expect(action({ owners: [] })).rejects.toBe(boom)
  })

  it("keeps a context failure throwing", async () => {
    const handler = vi.fn()
    const action = createDefineFormAction(() =>
      Promise.reject(new UnauthenticatedError())
    )(schema, handler)

    await expect(action({ owners: [] })).rejects.toBeInstanceOf(
      UnauthenticatedError
    )
    expect(handler).not.toHaveBeenCalled()
  })

  it("returns a result that survives a JSON round trip unchanged", async () => {
    const action = createDefineFormAction(() => Promise.resolve(context))(
      schema,
      () => ({ id: 1 })
    )
    const failure = await action({ owners: [{ percentage: 101 }] })
    const success = await action({ owners: [] })

    expect(JSON.parse(JSON.stringify(failure))).toEqual(failure)
    expect(JSON.parse(JSON.stringify(success))).toEqual(success)
  })
})

describe("createRequestDb", () => {
  it("builds the RLS client from the whole verified claims object", async () => {
    const { getRequestContext, getRequestDb } = createRequestDb({
      connectionString: () => "postgresql://lazy",
      supabase: supabaseReturning(getClaimsResult(claims, null)),
    })

    const context = await getRequestContext()

    expect(context.claims).toBe(claims)
    expect(createSupabaseClientMock).toHaveBeenCalledWith(claims, {
      connectionString: "postgresql://lazy",
    })
    await expect(getRequestDb()).resolves.toEqual({ claims, fake: true })
  })

  it("throws UnauthenticatedError when there is no session", async () => {
    const { getRequestDb } = createRequestDb({
      supabase: supabaseReturning(getClaimsResult(null, null)),
    })

    const error = await getRequestDb().catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(UnauthenticatedError)
    expect(error).toHaveProperty("name", "UnauthenticatedError")
    expect(createSupabaseClientMock).not.toHaveBeenCalled()
  })

  it("throws UnauthenticatedError for claims without a subject", async () => {
    const { getRequestDb } = createRequestDb({
      supabase: supabaseReturning(
        getClaimsResult({ ...claims, sub: "" }, null)
      ),
    })

    await expect(getRequestDb()).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it("rethrows a getClaims error as is", async () => {
    const failure = new AuthError("jwks unreachable")
    const { getRequestDb } = createRequestDb({
      supabase: supabaseReturning(getClaimsResult(null, failure)),
    })

    await expect(getRequestDb()).rejects.toBe(failure)
  })

  it("binds defineAction to the request context", async () => {
    const { defineAction } = createRequestDb({
      supabase: supabaseReturning(getClaimsResult(claims, null)),
    })
    const action = defineAction(z.string(), (db, input, context) => ({
      db,
      input,
      sub: context.claims.sub,
    }))

    await expect(action("hello")).resolves.toEqual({
      db: { claims, fake: true },
      input: "hello",
      sub: claims.sub,
    })
  })

  it("binds defineFormAction to the request context", async () => {
    const { defineFormAction } = createRequestDb({
      supabase: supabaseReturning(getClaimsResult(claims, null)),
    })
    const action = defineFormAction(z.string(), (_db, input, context) => ({
      input,
      sub: context.claims.sub,
    }))

    await expect(action("hello")).resolves.toEqual({
      data: { input: "hello", sub: claims.sub },
      ok: true,
    })
  })
})

describe("createRequestDb's read-only twin", () => {
  it("builds a query's object form on a read-only client, and a write's on a writable one", async () => {
    const { defineAction, defineQuery } = createRequestDb({
      supabase: supabaseReturning(getClaimsResult(claims, null)),
    })
    const options = {
      description: "Touch a row.",
      name: "touch_row",
      run: () => null,
      schema: z.string(),
    }

    await defineQuery(options)("a")
    expect(createSupabaseClientMock).toHaveBeenLastCalledWith(claims, {
      readOnly: true,
    })
    await defineAction(options)("a")
    expect(createSupabaseClientMock).toHaveBeenLastCalledWith(claims, {})
  })
})

describe("the object form", () => {
  const schema = z.object({ id: z.number().int().positive() }).strict()
  const requestContext = { claims: { sub: "request-user" }, db: "request-db" }

  it("returns the same action, with its definition on a key a spread never copies", async () => {
    const action = createDefineQuery(() => Promise.resolve(requestContext))({
      description: "Read one row.",
      name: "get_row",
      run: (db, input) => `${db}:${input.id}`,
      schema,
    })

    await expect(action({ id: 3 })).resolves.toBe("request-db:3")
    expect(action.definition).toMatchObject({
      description: "Read one row.",
      kind: "query",
      name: "get_row",
      readOnly: true,
    })
    expect(Object.keys(action)).toEqual([])
    expect(() => {
      ;(action as { definition: unknown }).definition = {}
    }).toThrow(TypeError)
  })

  it("marks every write as not read-only, so it always needs approval", () => {
    const getContext = () => Promise.resolve(requestContext)
    const options = {
      description: "Write one row.",
      name: "write_row",
      run: () => null,
      schema,
    }

    expect(createDefineAction(getContext)(options).definition).toMatchObject({
      kind: "action",
      readOnly: false,
    })
    expect(
      createDefineFormAction(getContext)(options).definition
    ).toMatchObject({ kind: "formAction", readOnly: false })
  })

  it("invoke runs as the context passed in, never the request's", async () => {
    const getContext = vi.fn(() => Promise.resolve(requestContext))
    const handler = vi.fn(() => undefined)
    const action = createDefineAction(getContext)({
      description: "Write one row.",
      name: "write_row",
      run: handler,
      schema,
    })
    const agentContext = { claims: { sub: "agent-user" }, db: "agent-db" }

    await expect(
      action.definition.invoke({ id: 1 }, agentContext)
    ).resolves.toBeNull()
    expect(handler).toHaveBeenCalledWith("agent-db", { id: 1 }, agentContext)
    expect(getContext).not.toHaveBeenCalled()
  })

  it("invoke parses before it runs", async () => {
    const handler = vi.fn()
    const action = createDefineAction(() => Promise.resolve(requestContext))({
      description: "Write one row.",
      name: "write_row",
      run: handler,
      schema,
    })

    await expect(
      action.definition.invoke({ id: -1 }, requestContext)
    ).rejects.toBeInstanceOf(z.ZodError)
    expect(handler).not.toHaveBeenCalled()
  })

  it("a form action's invoke returns its failures as an ActionResult", async () => {
    const action = createDefineFormAction(() =>
      Promise.resolve(requestContext)
    )({
      description: "Write one row.",
      name: "write_row",
      run: () => {
        throw new FieldValidationError({ id: "Taken" })
      },
      schema,
    })

    await expect(
      action.definition.invoke({ id: 1 }, requestContext)
    ).resolves.toEqual({
      error: { fieldErrors: { id: ["Taken"] }, formErrors: [] },
      ok: false,
    })
  })

  it("runs a query's object form, export and invoke, on the read-only twin", async () => {
    const readOnly = vi.fn((context: typeof requestContext) => ({
      ...context,
      db: `read-only ${context.db}`,
    }))
    const define = bindQuery(() => Promise.resolve(requestContext), readOnly)
    const query = define({
      description: "Read one row.",
      name: "get_row",
      run: (db, input) => `${db}:${input.id}`,
      schema,
    })

    await expect(query({ id: 1 })).resolves.toBe("read-only request-db:1")
    await expect(
      query.definition.invoke({ id: 2 }, requestContext)
    ).resolves.toBe("read-only request-db:2")
    await expect(
      define(schema, (db, input) => `${db}:${input.id}`)({ id: 3 })
    ).resolves.toBe("request-db:3")
  })

  it("describe parses the input, then reads the change on the read-only twin", async () => {
    const describeChange = vi.fn((db: string, input: { id: number }) => ({
      changes: [{ field: "status", from: "open", to: "closed" }],
      entity: `${db} row ${input.id}`,
    }))
    const action = bindAction(
      () => Promise.resolve(requestContext),
      (context) => ({ ...context, db: "read-only-db" })
    )({
      describeChange,
      description: "Close one row.",
      name: "close_row",
      run: () => null,
      schema,
    })

    await expect(
      action.definition.describe({ id: 4 }, requestContext)
    ).resolves.toMatchObject({ entity: "read-only-db row 4" })
    await expect(
      action.definition.describe({ id: -1 }, requestContext)
    ).rejects.toBeInstanceOf(z.ZodError)
    expect(describeChange).toHaveBeenCalledTimes(1)
  })

  it("describe resolves to null for a write without describeChange", async () => {
    const action = createDefineAction(() => Promise.resolve(requestContext))({
      description: "Write one row.",
      name: "write_row",
      run: () => null,
      schema,
    })

    await expect(
      action.definition.describe({ id: 1 }, requestContext)
    ).resolves.toBeNull()
  })

  it("a form action's describe throws a FieldValidationError for refused input", async () => {
    const describeChange = vi.fn(() => ({ changes: [], entity: "row" }))
    const action = createDefineFormAction(() =>
      Promise.resolve(requestContext)
    )({
      describeChange,
      description: "Write one row.",
      name: "write_row",
      run: () => null,
      schema,
    })

    await expect(
      action.definition.describe({ id: "one" }, requestContext)
    ).rejects.toBeInstanceOf(FieldValidationError)
    expect(describeChange).not.toHaveBeenCalled()
  })

  it.each(["list rows", "", "x".repeat(65), "liste_dossiers_é"])(
    "rejects %j, which a tool list could not use",
    (name) => {
      expect(() =>
        createDefineQuery(() => Promise.resolve(requestContext))({
          description: "Read rows.",
          name,
          run: () => null,
          schema,
        })
      ).toThrow(TypeError)
    }
  )
})

describe("getBearerContext", () => {
  const oauthClaims: JwtPayload = { ...claims, client_id: "client-1" }

  function bearerRequest(authorization?: string): Request {
    return new Request("https://app.test/mcp", {
      headers: authorization ? { authorization } : {},
    })
  }

  function sessionReturning(
    result: GetClaimsResult,
    user: Partial<User> | AuthError = { id: claims.sub }
  ) {
    const getUser = vi.fn(() =>
      Promise.resolve(
        user instanceof AuthError
          ? { data: { user: null }, error: user }
          : { data: { user: user as User }, error: null }
      )
    )
    const source = {
      auth: { getClaims: () => Promise.resolve(result), getUser },
    } as unknown as SessionSource
    return { getUser, supabase: () => source }
  }

  function bearerDb(bearer: Partial<BearerOptions> = {}) {
    return createRequestDb({
      bearer: {
        client: (clientId) => (clientId === "client-1" ? "Agent" : null),
        supabase: sessionReturning(getClaimsResult(oauthClaims, null)).supabase,
        ...bearer,
      },
      supabase: supabaseReturning(getClaimsResult(null, null)),
    })
  }

  it("verifies the token, then builds the RLS client with the client's via", async () => {
    const client = vi.fn(() => "Agent")
    const { getBearerContext } = bearerDb({ client })

    const context = await getBearerContext(bearerRequest("Bearer token-1"))

    expect(context).toMatchObject({
      claims: oauthClaims,
      clientId: "client-1",
      token: "token-1",
      via: "Agent",
    })
    expect(client).toHaveBeenCalledWith("client-1")
    expect(createSupabaseClientMock).toHaveBeenCalledWith(oauthClaims, {
      via: "Agent",
    })
  })

  it.each([
    { authorization: undefined, name: "no Authorization header" },
    { authorization: "Basic dXNlcjpwYXNz", name: "another scheme" },
    { authorization: "Bearer ", name: "an empty token" },
  ])("refuses $name", async ({ authorization }) => {
    const { getBearerContext } = bearerDb()

    await expect(
      getBearerContext(bearerRequest(authorization))
    ).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it.each([
    {
      name: "a token that fails verification",
      result: getClaimsResult(null, new AuthInvalidJwtError("jwt expired")),
    },
    {
      name: "a token Auth rejects",
      result: getClaimsResult(
        null,
        new AuthApiError("invalid JWT", 403, "bad_jwt")
      ),
    },
    {
      name: "claims without a subject",
      result: getClaimsResult({ ...oauthClaims, sub: "" }, null),
    },
    {
      name: "a role other than authenticated, which would run as anon",
      result: getClaimsResult({ ...oauthClaims, role: "staff" }, null),
    },
    {
      name: "a token not issued to an OAuth client",
      result: getClaimsResult(claims, null),
    },
    {
      name: "a client that is not registered",
      result: getClaimsResult({ ...oauthClaims, client_id: "other" }, null),
    },
  ])("refuses $name without building a client", async ({ result }) => {
    const { getBearerContext } = bearerDb({
      supabase: sessionReturning(result).supabase,
    })

    await expect(
      getBearerContext(bearerRequest("Bearer token-1"))
    ).rejects.toBeInstanceOf(UnauthenticatedError)
    expect(createSupabaseClientMock).not.toHaveBeenCalled()
  })

  it("refuses a client the lookup does not know, even as undefined", async () => {
    const labels: Record<string, string> = { "client-2": "Agent" }
    const { getBearerContext } = bearerDb({ client: (id) => labels[id] })

    await expect(
      getBearerContext(bearerRequest("Bearer token-1"))
    ).rejects.toBeInstanceOf(UnauthenticatedError)
    expect(createSupabaseClientMock).not.toHaveBeenCalled()
  })

  it.each([
    {
      error: new SyntaxError("Unexpected token"),
      name: "parts that are not JSON",
    },
    {
      error: new TypeError("Cannot read properties of null"),
      name: "a null header",
    },
    { error: new Error("Invalid alg claim"), name: "an alg it cannot verify" },
  ])("refuses a token getClaims throws on: $name", async ({ error }) => {
    const source = {
      auth: { getClaims: () => Promise.reject(error) },
    } as unknown as SessionSource
    const { getBearerContext } = bearerDb({ supabase: () => source })

    await expect(
      getBearerContext(bearerRequest("Bearer bnVsbA.e30.AA"))
    ).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it.each([
    {
      failure: new AuthRetryableFetchError("fetch failed", 0),
      name: "unreachable",
    },
    {
      failure: new AuthApiError(
        "Too many requests",
        429,
        "over_request_rate_limit"
      ),
      name: "rate limiting",
    },
  ])(
    "rethrows Auth $name, which is not the token's fault",
    async ({ failure }) => {
      const { getBearerContext } = bearerDb({
        supabase: sessionReturning(getClaimsResult(null, failure)).supabase,
      })

      await expect(
        getBearerContext(bearerRequest("Bearer token-1"))
      ).rejects.toBe(failure)
    }
  )

  it("with confirmSession, refuses a token whose session has ended", async () => {
    const { getUser, supabase } = sessionReturning(
      getClaimsResult(oauthClaims, null),
      new AuthApiError("Session not found", 403, "session_not_found")
    )
    const { getBearerContext } = bearerDb({ confirmSession: true, supabase })

    const error = await getBearerContext(bearerRequest("Bearer token-1")).catch(
      (caught: unknown) => caught
    )

    expect(error).toBeInstanceOf(UnauthenticatedError)
    expect(error).toHaveProperty("cause.code", "session_not_found")
    expect(getUser).toHaveBeenCalledWith("token-1")
  })

  it("with confirmSession, refuses a session that belongs to someone else", async () => {
    const { getBearerContext } = bearerDb({
      confirmSession: true,
      supabase: sessionReturning(getClaimsResult(oauthClaims, null), {
        id: "someone-else",
      }).supabase,
    })

    await expect(
      getBearerContext(bearerRequest("Bearer token-1"))
    ).rejects.toBeInstanceOf(UnauthenticatedError)
  })

  it("does not ask Auth for the session unless told to", async () => {
    const { getUser, supabase } = sessionReturning(
      getClaimsResult(oauthClaims, null)
    )
    const { getBearerContext } = bearerDb({ supabase })

    await getBearerContext(bearerRequest("Bearer token-1"))

    expect(getUser).not.toHaveBeenCalled()
  })

  it("throws a configuration error without the bearer option", async () => {
    const { getBearerContext } = createRequestDb({
      supabase: supabaseReturning(getClaimsResult(claims, null)),
    })

    const error = await getBearerContext(bearerRequest("Bearer token-1")).catch(
      (caught: unknown) => caught
    )

    expect(error).toBeInstanceOf(Error)
    expect(error).not.toBeInstanceOf(UnauthenticatedError)
  })
})

describe("withVia", () => {
  it("keeps the caller and rebuilds the RLS client with the via marker", async () => {
    const { getRequestContext, withVia } = createRequestDb({
      supabase: supabaseReturning(getClaimsResult(claims, null)),
    })
    const context = await getRequestContext()

    const assisted = withVia(context, "Assistant")

    expect(context.via).toBeNull()
    expect(assisted).toMatchObject({ claims, via: "Assistant" })
    expect(createSupabaseClientMock).toHaveBeenLastCalledWith(claims, {
      via: "Assistant",
    })
  })
})
