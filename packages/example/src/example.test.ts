import {
  createAdminDrizzle,
  createDrizzleClients,
  createSupabaseDrizzle,
  type SupabaseAuthClientLike,
} from "@zeno-lib/db"
import { describe, expect, it, vi } from "vitest"

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

function fakeSupabase(): SupabaseAuthClientLike {
  return {
    auth: {
      getClaims: vi.fn(async () => ({ data: { claims: {} }, error: null })),
    },
  } as unknown as SupabaseAuthClientLike
}

describe("createDrizzleClients", () => {
  it("throws when DATABASE_URL is unset and no override is provided", () => {
    vi.stubEnv("DATABASE_URL", "")
    expect(() => createDrizzleClients({ schema: {} })).toThrow(
      "Missing DATABASE_URL environment variable"
    )
    vi.unstubAllEnvs()
  })
})

describe("createSupabaseDrizzle", () => {
  it("exposes a directly-queryable RLS client without connecting eagerly", async () => {
    const db = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: {},
      supabase: fakeSupabase(),
    })

    // Query the signed-in user directly; multi-statement work via transaction.
    expect(db.select).toEqual(expect.any(Function))
    expect(db.transaction).toEqual(expect.any(Function))
    expect(db.close).toEqual(expect.any(Function))

    await db.close({ timeout: 0 })
  })

  it("throws at creation when no Supabase client is provided", () => {
    expect(() =>
      createSupabaseDrizzle({
        connectionString: LOCAL_DB_URL,
        schema: {},
      } as never)
    ).toThrow("requires a Supabase client")
  })

  it("throws at creation when given a null Supabase client", () => {
    expect(() =>
      createSupabaseDrizzle({
        connectionString: LOCAL_DB_URL,
        schema: {},
        supabase: null,
      } as never)
    ).toThrow("requires a Supabase client")
  })
})

describe("createAdminDrizzle", () => {
  it("exposes a directly-queryable admin client without connecting eagerly", async () => {
    const db = createAdminDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: {},
    })

    expect(db.select).toEqual(expect.any(Function))
    expect(db.transaction).toEqual(expect.any(Function))
    expect(db.close).toEqual(expect.any(Function))

    await db.close({ timeout: 0 })
  })
})
