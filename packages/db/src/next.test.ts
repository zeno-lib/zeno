import { AuthError, type JwtPayload } from "@supabase/supabase-js"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { z } from "zod"
import { createDefineAction } from "./define-action.ts"

// No database: the RLS client factory is replaced by a stub that returns a
// marker object, so nothing here builds a pool or opens a connection. What
// that client does with the claims is covered by test/rls.integration.test.ts.
const { createSupabaseClientMock } = vi.hoisted(() => ({
  createSupabaseClientMock: vi.fn((claims: unknown) => ({
    claims,
    fake: true,
  })),
}))

vi.mock("./clients.ts", () => ({
  createSupabaseClient: createSupabaseClientMock,
}))

import {
  type ClaimsSource,
  createRequestDb,
  UnauthenticatedError,
} from "./next.ts"

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
})
