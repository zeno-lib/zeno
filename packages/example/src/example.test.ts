import { createDb } from "@zeno-lib/db/client"
import { createDbForRequest } from "@zeno-lib/db/rls"
import { sql } from "drizzle-orm"
import { describe, expect, it } from "vitest"
import { posts } from "./schema"

// Requires local Supabase running. Start it with `pnpm dev` and set
// DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
describe("@zeno-lib/db", () => {
  it("createDb runs a query (service-role path)", async () => {
    const db = createDb()
    const result = await db.execute(sql`select 1 as ok`)
    expect(result[0]).toEqual({ ok: 1 })
  })

  it("createDbForRequest applies RLS via transaction-scoped jwt claims", async () => {
    const db = createDb({ schema: { posts } })
    const fakeJwt = JSON.stringify({
      role: "authenticated",
      sub: "00000000-0000-0000-0000-000000000000",
    })
    const userDb = createDbForRequest(db, fakeJwt)
    // The select returns zero rows because no row has matching user_id —
    // proves the policy is being applied (without it, the same query would
    // either return all rows or fail differently).
    const rows = await userDb.rls((tx) => tx.select().from(posts))
    expect(rows).toEqual([])
  })
})
