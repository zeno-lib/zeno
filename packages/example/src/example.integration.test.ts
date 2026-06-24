import type { SupabaseClient } from "@supabase/supabase-js"
import { createAdminDrizzle, createSupabaseDrizzle } from "@zeno-lib/db"
import { defineRelations, sql } from "drizzle-orm"
import { afterAll, describe, expect, it, vi } from "vitest"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema needs every table
import * as schema from "./schema"
import { posts } from "./schema"

// DATABASE_URL is injected by vitest.config.ts (local Supabase on 54322).
// Start it with `pnpm dev` before running these tests.

const LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
const TOKEN = {
  role: "authenticated",
  sub: "00000000-0000-0000-0000-000000000000",
}
// Relations enable the relational query API (`db.query.<table>.findMany()`).
// Pass the same stable `relations` object to every db sharing this schema + url
// so the cached drizzle pools are built with relations enabled.
const relations = defineRelations(schema)
const adminDb = createAdminDrizzle({ relations, schema })

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

describe("createAdminDrizzle", () => {
  it("bypasses RLS (runs as postgres)", async () => {
    const result = await adminDb.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "postgres" })
  })

  it("accepts an explicit connectionString override", async () => {
    const db = createAdminDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: {},
    })
    const result = await db.execute(sql`select 1 as ok`)

    expect(result[0]).toEqual({ ok: 1 })

    await db.close({ timeout: 0 })
  })
})

describe("createSupabaseDrizzle (direct RLS query client)", () => {
  it("uses the Supabase client passed at creation time", async () => {
    const supabase = createSupabase(TOKEN)
    const db = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      relations,
      schema,
      supabase,
    })

    const result = await db.execute(sql`select current_user as role`)

    expect(supabase.auth.getClaims).toHaveBeenCalledOnce()
    expect(result[0]).toEqual({ role: "authenticated" })
  })

  it("switches the role to the verified claims' role", async () => {
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase(TOKEN),
    })
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "authenticated" })
  })

  it("sets request.jwt.claims (JSON) so auth.uid() resolves the sub", async () => {
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase(TOKEN),
    })
    const result = await db.execute(
      sql`select current_setting('request.jwt.claims', true) as claims, auth.uid() as uid`
    )
    const row = result[0] as { claims: string; uid: string }
    expect(JSON.parse(row.claims)).toMatchObject(TOKEN)
    expect(row.uid).toBe(TOKEN.sub)
  })

  it("falls back to the anon role for an unknown/forged role claim", async () => {
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase({ role: "postgres" }),
    })
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "anon" })
  })

  it("does not allow the request-scoped client to switch into service_role", async () => {
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase({
        role: "service_role",
        sub: TOKEN.sub,
      }),
    })
    const result = await db.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "anon" })
  })

  it("normalizes request.jwt.claims role to the enforced session role", async () => {
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase({ role: "service_role", sub: TOKEN.sub }),
    })
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
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase(TOKEN),
    })
    await db.execute(sql`select 1`)
    // The admin pool is a separate connection — never role-switched, and the
    // claim was never set on it (null, not "").
    const result = await adminDb.execute(
      sql`select current_user as role, current_setting('request.jwt.claims', true) as claims`
    )
    expect(result[0]).toEqual({ claims: null, role: "postgres" })
  })

  it("applies RLS policies — non-matching sub returns 0 rows", async () => {
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase(TOKEN),
    })
    const rows = await db.select().from(posts)
    expect(rows).toEqual([])
  })

  it("applies RLS policies through the relational query API", async () => {
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase(TOKEN),
    })
    const rows = await db.query.posts.findMany()
    expect(rows).toEqual([])
  })
})

describe("db.transaction (multi-statement)", () => {
  it("runs several statements under one role-switched transaction", async () => {
    const db = createSupabaseDrizzle({
      relations,
      schema,
      supabase: createSupabase(TOKEN),
    })

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
