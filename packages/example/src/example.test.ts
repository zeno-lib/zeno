import { createDrizzleClients, createSupabaseDrizzle } from "@zeno-lib/db"
import { describe, expect, test } from "vitest"

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

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
  it("exposes the ergonomic db surface without connecting eagerly", async () => {
    const db = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: {},
    })

    expect(db.admin).toBeDefined()
    expect(db.rls).toEqual(expect.any(Function))
    expect(db.close).toEqual(expect.any(Function))

    await db.close({ timeout: 0 })
  })

  it("fails loudly when rls is used without a Supabase client", async () => {
    const db = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: {},
    })

    await expect(db.rls(async () => [])).rejects.toThrow(
      "Missing Supabase client for RLS"
    )

    await db.close({ timeout: 0 })
  })
})
