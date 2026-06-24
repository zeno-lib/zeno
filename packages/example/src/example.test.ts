import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminDrizzle, createSupabaseDrizzle } from "@zeno-lib/db"
import { describe, expect, it, vi } from "vitest"

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

function fakeSupabase(): SupabaseClient {
  return {
    auth: {
      getClaims: vi.fn(async () => ({ data: { claims: {} }, error: null })),
    },
  } as unknown as SupabaseClient
}

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
})

describe("createAdminDrizzle", () => {
  it("throws when DATABASE_URL is unset and no override is provided", () => {
    vi.stubEnv("DATABASE_URL", "")
    expect(() => createAdminDrizzle({ schema: {} })).toThrow(
      "Missing DATABASE_URL environment variable"
    )
    vi.unstubAllEnvs()
  })

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
