import { createDb } from "@zeno-lib/db/client"
import { createDbForRequest } from "@zeno-lib/db/rls"
import { sql } from "drizzle-orm"
import { describe, expect, it, vi } from "vitest"
import { posts } from "./schema"

// DATABASE_URL is injected by vitest.config.ts (local Supabase on 54322).
// Start it with `pnpm dev` before running these tests.

describe("createDb", () => {
  it("throws when DATABASE_URL is unset and no override is provided", () => {
    vi.stubEnv("DATABASE_URL", "")
    expect(() => createDb()).toThrow(
      "Missing DATABASE_URL environment variable"
    )
    vi.unstubAllEnvs()
  })

  it("accepts an explicit connectionString override", async () => {
    const db = createDb({
      connectionString:
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    })
    const result = await db.execute(sql`select 1 as ok`)
    expect(result[0]).toEqual({ ok: 1 })
  })

  it("runs a query against the service-role connection (bypasses RLS)", async () => {
    const db = createDb()
    const result = await db.execute(sql`select current_user as role`)
    // Default connection role is `postgres` (service-equivalent) — not
    // `authenticated`, so RLS does not apply.
    expect(result[0]).toEqual({ role: "postgres" })
  })
})

describe("createDbForRequest", () => {
  const fakeJwt = JSON.stringify({
    role: "authenticated",
    sub: "00000000-0000-0000-0000-000000000000",
  })

  it("switches the role to 'authenticated' inside rls()", async () => {
    const db = createDb()
    const userDb = createDbForRequest(db, fakeJwt)
    const result = await userDb.rls((tx) =>
      tx.execute(sql`select current_user as role`)
    )
    expect(result[0]).toEqual({ role: "authenticated" })
  })

  it("sets request.jwt.claims to the provided JWT inside rls()", async () => {
    const db = createDb()
    const userDb = createDbForRequest(db, fakeJwt)
    const result = await userDb.rls((tx) =>
      tx.execute(
        sql`select current_setting('request.jwt.claims', true) as claims`
      )
    )
    expect(result[0]).toEqual({ claims: fakeJwt })
  })

  it("scopes role and claims to the transaction (does not leak)", async () => {
    const db = createDb()
    const userDb = createDbForRequest(db, fakeJwt)
    await userDb.rls((tx) => tx.execute(sql`select 1`))
    // Outside the rls() transaction, the parent db should still be `postgres`
    // with no jwt claims set on this connection's session.
    const result = await db.execute(
      sql`select current_user as role, current_setting('request.jwt.claims', true) as claims`
    )
    expect(result[0]).toEqual({ claims: "", role: "postgres" })
  })

  it("applies RLS policies — non-matching sub returns 0 rows", async () => {
    const db = createDb({ schema: { posts } })
    const userDb = createDbForRequest(db, fakeJwt)
    const rows = await userDb.rls((tx) => tx.select().from(posts))
    expect(rows).toEqual([])
  })
})
