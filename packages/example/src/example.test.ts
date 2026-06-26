import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createAdminClient,
  createAnonClient,
  createAuthClient,
  createServiceClient,
  createSupabaseClient,
  type SupabaseToken,
} from "@zeno-lib/db"
import { describe, expect, it, vi } from "vitest"

const TOKEN: SupabaseToken = {
  role: "authenticated",
  sub: "00000000-0000-0000-0000-000000000000",
}

function fakeSupabase(): SupabaseClient {
  return {
    auth: {
      getClaims: vi.fn(async () => ({ data: { claims: {} }, error: null })),
    },
  } as unknown as SupabaseClient
}

describe("createAdminClient", () => {
  it("throws when SUPABASE_DATABASE_URL is unset and no override is provided", () => {
    vi.stubEnv("SUPABASE_DATABASE_URL", "")
    expect(() => createAdminClient()).toThrow(
      "Missing SUPABASE_DATABASE_URL environment variable"
    )
    vi.unstubAllEnvs()
  })

  it("exposes a directly-queryable admin client without connecting eagerly", async () => {
    const db = createAdminClient()

    expect(db.select).toEqual(expect.any(Function))
    expect(db.transaction).toEqual(expect.any(Function))
    expect(db.close).toEqual(expect.any(Function))

    await db.close({ timeout: 0 })
  })
})

describe("RLS clients", () => {
  it("createAuthClient exposes a directly-queryable client without connecting eagerly", async () => {
    const db = createAuthClient(fakeSupabase())

    // Query the signed-in user directly; multi-statement work via transaction.
    expect(db.select).toEqual(expect.any(Function))
    expect(db.transaction).toEqual(expect.any(Function))
    expect(db.close).toEqual(expect.any(Function))

    await db.close({ timeout: 0 })
  })

  it("createSupabaseClient exposes a directly-queryable client", async () => {
    const db = createSupabaseClient(TOKEN)

    expect(db.select).toEqual(expect.any(Function))
    expect(db.transaction).toEqual(expect.any(Function))
    expect(db.close).toEqual(expect.any(Function))

    await db.close({ timeout: 0 })
  })

  it("createAnonClient and createServiceClient expose directly-queryable clients", async () => {
    const anon = createAnonClient()
    const service = createServiceClient()

    for (const db of [anon, service]) {
      expect(db.select).toEqual(expect.any(Function))
      expect(db.transaction).toEqual(expect.any(Function))
      expect(db.close).toEqual(expect.any(Function))
    }

    await anon.close({ timeout: 0 })
    await service.close({ timeout: 0 })
  })
})
