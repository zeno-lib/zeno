import {
  createAdminDrizzle,
  createDrizzleClients,
  createSupabaseDrizzle,
  type SupabaseAuthClientLike,
} from "@zeno-lib/db"
import { defineRelations, eq, isNull, sql } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
// biome-ignore lint/performance/noNamespaceImport: drizzle schema needs every table
import * as schema from "./schema"
import {
  customers,
  details,
  employees,
  orders,
  posts,
  products,
  suppliers,
} from "./schema"
import { SEED_COUNTS, seedDatabase } from "./seed"

// DATABASE_URL is injected by vitest.config.ts (local Supabase on 54322).
// Start it with `pnpm dev` before running these tests.

const PHONE_TEMPLATE = /^\(\d{3}\) \d{3}-\d{4}$/
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

function createSupabase(
  claims: Record<string, unknown>
): SupabaseAuthClientLike {
  return {
    auth: {
      getClaims: vi.fn(async () => ({
        data: { claims },
        error: null,
      })),
    },
  } as unknown as SupabaseAuthClientLike
}

// Package-level factory contract (the reusable engine in @zeno-lib/db).
describe("createDrizzleClients", () => {
  it("accepts an explicit connectionString override", async () => {
    const clients = createDrizzleClients({
      connectionString: LOCAL_DB_URL,
      schema: {},
    })
    const result = await clients
      .getDrizzleSupabaseAdminClient()
      .execute(sql`select 1 as ok`)

    expect(result[0]).toEqual({ ok: 1 })

    await clients.closeDrizzleSupabaseClients({ timeout: 0 })
  })
})

describe("createAdminDrizzle", () => {
  it("bypasses RLS (runs as postgres)", async () => {
    const result = await adminDb.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "postgres" })
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

describe("northwind seed", () => {
  beforeAll(async () => {
    await seedDatabase(adminDb)
  }, 60_000)

  it("inserts the configured number of rows per top-level table", async () => {
    expect(await adminDb.$count(customers)).toBe(SEED_COUNTS.customers)
    expect(await adminDb.$count(employees)).toBe(SEED_COUNTS.employees)
    expect(await adminDb.$count(suppliers)).toBe(SEED_COUNTS.suppliers)
    expect(await adminDb.$count(products)).toBe(SEED_COUNTS.products)
    expect(await adminDb.$count(orders)).toBe(SEED_COUNTS.orders)
  })

  it("reads seeded rows through the relational query API (bypassing RLS)", async () => {
    const rows = await adminDb.query.customers.findMany()
    expect(rows).toHaveLength(SEED_COUNTS.customers)
  })

  it("creates 1-25 detail rows per order via the weighted `with`", async () => {
    const detailCount = await adminDb.$count(details)
    expect(detailCount).toBeGreaterThanOrEqual(SEED_COUNTS.orders)
    expect(detailCount).toBeLessThanOrEqual(SEED_COUNTS.orders * 25)
  })

  it("wires every order to a real customer and employee (FK integrity)", async () => {
    const orphanCustomer = await adminDb
      .select({ id: orders.id })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(isNull(customers.id))
    const orphanEmployee = await adminDb
      .select({ id: orders.id })
      .from(orders)
      .leftJoin(employees, eq(orders.employeeId, employees.id))
      .where(isNull(employees.id))
    expect(orphanCustomer).toHaveLength(0)
    expect(orphanEmployee).toHaveLength(0)
  })

  it("wires every detail to a real order and product (FK integrity)", async () => {
    const orphanOrder = await adminDb
      .select({ orderId: details.orderId })
      .from(details)
      .leftJoin(orders, eq(details.orderId, orders.id))
      .where(isNull(orders.id))
    const orphanProduct = await adminDb
      .select({ productId: details.productId })
      .from(details)
      .leftJoin(products, eq(details.productId, products.id))
      .where(isNull(products.id))
    expect(orphanOrder).toHaveLength(0)
    expect(orphanProduct).toHaveLength(0)
  })

  it("applies the phone-number template generator", async () => {
    const rows = await adminDb
      .select({ phone: customers.phone })
      .from(customers)
      .limit(1)
    expect(rows[0]?.phone).toMatch(PHONE_TEMPLATE)
  })
})
