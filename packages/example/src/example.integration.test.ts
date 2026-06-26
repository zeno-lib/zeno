import type { SupabaseClient } from "@supabase/supabase-js"
import {
  createAdminClient,
  createAnonClient,
  createAuthClient,
  createServiceClient,
  createSupabaseClient,
  type SupabaseToken,
} from "@zeno-lib/db"
import { defineRelations, sql } from "drizzle-orm"
import { afterAll, describe, expect, it, vi } from "vitest"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema needs every table
import * as schema from "./schema"
import { posts } from "./schema"

// SUPABASE_DATABASE_URL is injected by vitest.config.ts (local Supabase on
// 54322). Start it with `pnpm dev` before running these tests.

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
const TOKEN: SupabaseToken = {
  role: "authenticated",
  sub: "00000000-0000-0000-0000-000000000000",
}
// Relations enable the relational query API (`db.query.<table>.findMany()`).
const relations = defineRelations(schema)
const adminDb = createAdminClient({ relations })

afterAll(async () => {
  await adminDb.close({ timeout: 0 })
})

function createSupabase(claims: Record<string, unknown>): SupabaseClient {
  return {
    auth: {
      getClaims: vi.fn(async () => ({
        data: { claims },
        error: null,
      })),
    },
  } as unknown as SupabaseClient
}

describe("createAdminClient", () => {
  it("bypasses RLS (runs as postgres)", async () => {
    const result = await adminDb.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "postgres" })
  })

  it("accepts an explicit connectionString override", async () => {
    const db = createAdminClient({ connectionString: LOCAL_DB_URL })
    const result = await db.execute(sql`select 1 as ok`)

    expect(result[0]).toEqual({ ok: 1 })

    await db.close({ timeout: 0 })
  })
})

describe("createAnonClient / createServiceClient", () => {
  it("createAnonClient runs as the anon role", async () => {
    const db = createAnonClient({ relations })
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "anon" })
  })

  it("createServiceClient runs as the service_role", async () => {
    const db = createServiceClient({ relations })
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "service_role" })
  })
})

describe("createSupabaseClient (decoded token)", () => {
  it("switches the role to the clamped token role", async () => {
    const db = createSupabaseClient(TOKEN, { relations })
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "authenticated" })
  })

  it("clamps a forged service_role token down to anon", async () => {
    const db = createSupabaseClient(
      { role: "service_role", sub: TOKEN.sub },
      { relations }
    )
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "anon" })
  })
})

describe("createAuthClient (direct RLS query client)", () => {
  it("resolves claims from the Supabase client passed at creation time", async () => {
    const supabase = createSupabase(TOKEN)
    const db = createAuthClient(supabase, { relations })

    const result = await db.execute(sql`select current_user as role`)

    expect(supabase.auth.getClaims).toHaveBeenCalledOnce()
    expect(result[0]).toEqual({ role: "authenticated" })
  })

  it("sets request.jwt.claims (JSON) so auth.uid() resolves the sub", async () => {
    const db = createAuthClient(createSupabase(TOKEN), { relations })
    const result = await db.execute(
      sql`select current_setting('request.jwt.claims', true) as claims, auth.uid() as uid`
    )
    const row = result[0] as { claims: string; uid: string }
    expect(JSON.parse(row.claims)).toMatchObject({
      role: "authenticated",
      sub: TOKEN.sub,
    })
    expect(row.uid).toBe(TOKEN.sub)
  })

  it("falls back to the anon role for an unknown/forged role claim", async () => {
    const db = createAuthClient(createSupabase({ role: "postgres" }), {
      relations,
    })
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "anon" })
  })

  it("does not allow the request-scoped client to switch into service_role", async () => {
    const db = createAuthClient(
      createSupabase({ role: "service_role", sub: TOKEN.sub }),
      { relations }
    )
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "anon" })
  })

  it("normalizes request.jwt.claims role to the enforced session role", async () => {
    const db = createAuthClient(
      createSupabase({ role: "service_role", sub: TOKEN.sub }),
      { relations }
    )
    const result = await db.execute(
      sql`select current_user as role, current_setting('request.jwt.claims', true) as claims`
    )
    const row = result[0] as { role: string; claims: string }
    // Connection role was downgraded to anon, and the claims a policy would read
    // via auth.jwt() agree with it instead of leaking the rejected service_role.
    expect(row.role).toBe("anon")
    expect((JSON.parse(row.claims) as { role: string }).role).toBe("anon")
  })

  it("scopes role and claims to the transaction (does not leak)", async () => {
    const db = createAuthClient(createSupabase(TOKEN), { relations })
    await db.execute(sql`select 1`)
    // The admin client is never role-switched, and the claim was never set on it
    // (transaction-local context resets at commit).
    const result = await adminDb.execute(
      sql`select current_user as role, current_setting('request.jwt.claims', true) as claims`
    )
    expect(result[0]).toEqual({ claims: null, role: "postgres" })
  })

  it("applies RLS policies — non-matching sub returns 0 rows", async () => {
    const db = createAuthClient(createSupabase(TOKEN), { relations })
    const rows = await db.select().from(posts)
    expect(rows).toEqual([])
  })

  it("applies RLS policies through the relational query API", async () => {
    const db = createAuthClient(createSupabase(TOKEN), { relations })
    const rows = await db.query.posts.findMany()
    expect(rows).toEqual([])
  })
})

describe("db.transaction (multi-statement)", () => {
  it("runs several statements under one role-switched transaction", async () => {
    const db = createAuthClient(createSupabase(TOKEN), { relations })

    const result = await db.transaction(async (tx) => {
      const role = await tx.execute(sql`select current_user as role`)
      const uid = await tx.execute(sql`select auth.uid() as uid`)
      return { role: role[0], uid: uid[0] }
    })

    // Both statements observed the same authenticated, sub-bearing context.
    expect(result.role).toEqual({ role: "authenticated" })
    expect(result.uid).toEqual({ uid: TOKEN.sub })
  })
})
