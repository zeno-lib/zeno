import {
  createDrizzleClients,
  createSupabaseDrizzle,
  type SupabaseAuthClientLike,
  type SupabaseTokenClaims,
} from "@zeno-lib/db"
import { eq, isNull, sql } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { db } from "./clients"
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

// Build an unsigned access_token-shaped string to prove the DB package does
// not decode or trust raw JWTs.
function makeAccessToken(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`
}

function createSupabase(claims: SupabaseTokenClaims): SupabaseAuthClientLike {
  return {
    auth: {
      getClaims: vi.fn(async () => ({
        data: { claims },
        error: null,
      })),
    },
  }
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

describe("db.admin", () => {
  it("bypasses RLS (runs as postgres)", async () => {
    const result = await db.admin.execute(sql`select current_user as role`)
    expect(result[0]).toEqual({ role: "postgres" })
  })
})

describe("db.rls", () => {
  it("uses the Supabase client passed at creation time", async () => {
    const supabase = createSupabase(TOKEN)
    const dbWithSupabase = createSupabaseDrizzle({
      connectionString: LOCAL_DB_URL,
      schema: {},
      supabase,
    })

    const result = await dbWithSupabase.rls((tx) =>
      tx.execute(sql`select current_user as role`)
    )

    expect(supabase.auth.getClaims).toHaveBeenCalledOnce()
    expect(result[0]).toEqual({ role: "authenticated" })

    await dbWithSupabase.close({ timeout: 0 })
  })

  it("switches the role to the verified claims' role inside rls", async () => {
    const dbWithSupabase = createSupabaseDrizzle({
      schema: {},
      supabase: createSupabase(TOKEN),
    })
    const result = await dbWithSupabase.rls((tx) =>
      tx.execute(sql`select current_user as role`)
    )
    expect(result[0]).toEqual({ role: "authenticated" })

    await dbWithSupabase.close({ timeout: 0 })
  })

  it("sets request.jwt.claims (JSON) so auth.uid() resolves the sub", async () => {
    const dbWithSupabase = createSupabaseDrizzle({
      schema: {},
      supabase: createSupabase(TOKEN),
    })
    const result = await dbWithSupabase.rls((tx) =>
      tx.execute(
        sql`select current_setting('request.jwt.claims', true) as claims, auth.uid() as uid`
      )
    )
    const row = result[0] as { claims: string; uid: string }
    expect(JSON.parse(row.claims)).toMatchObject(TOKEN)
    expect(row.uid).toBe(TOKEN.sub)

    await dbWithSupabase.close({ timeout: 0 })
  })

  it("falls back to the anon role for an unknown/forged role claim", async () => {
    const dbWithSupabase = createSupabaseDrizzle({
      schema: {},
      supabase: createSupabase({ role: "postgres" }),
    })
    const result = await dbWithSupabase.rls((tx) =>
      tx.execute(sql`select current_user as role`)
    )
    expect(result[0]).toEqual({ role: "anon" })

    await dbWithSupabase.close({ timeout: 0 })
  })

  it("does not allow the request-scoped client to switch into service_role", async () => {
    const dbWithSupabase = createSupabaseDrizzle({
      schema: {},
      supabase: createSupabase({
        role: "service_role",
        sub: TOKEN.sub,
      }),
    })
    const result = await dbWithSupabase.rls((tx) =>
      tx.execute(sql`select current_user as role`)
    )
    expect(result[0]).toEqual({ role: "anon" })

    await dbWithSupabase.close({ timeout: 0 })
  })

  it("does not decode or trust raw access token strings", async () => {
    const dbWithSupabase = createSupabaseDrizzle({
      schema: {},
      supabase: makeAccessToken(TOKEN) as unknown as SupabaseTokenClaims,
    })
    const result = await dbWithSupabase.rls((tx) =>
      tx.execute(sql`select current_user as role`)
    )
    expect(result[0]).toEqual({ role: "anon" })

    await dbWithSupabase.close({ timeout: 0 })
  })

  it("scopes role and claims to the transaction (does not leak)", async () => {
    const dbWithSupabase = createSupabaseDrizzle({
      schema: {},
      supabase: createSupabase(TOKEN),
    })
    await dbWithSupabase.rls((tx) => tx.execute(sql`select 1`))
    // The admin pool is a separate connection — never role-switched, and the
    // claim was never set on it (null, not "").
    const result = await db.admin.execute(
      sql`select current_user as role, current_setting('request.jwt.claims', true) as claims`
    )
    expect(result[0]).toEqual({ claims: null, role: "postgres" })

    await dbWithSupabase.close({ timeout: 0 })
  })

  it("applies RLS policies — non-matching sub returns 0 rows", async () => {
    const dbWithSupabase = createSupabaseDrizzle({
      schema: {},
      supabase: createSupabase(TOKEN),
    })
    const rows = await dbWithSupabase.rls((tx) => tx.select().from(posts))
    expect(rows).toEqual([])

    await dbWithSupabase.close({ timeout: 0 })
  })
})

describe("northwind seed", () => {
  beforeAll(async () => {
    await seedDatabase(db.admin)
  }, 60_000)

  it("inserts the configured number of rows per top-level table", async () => {
    expect(await db.admin.$count(customers)).toBe(SEED_COUNTS.customers)
    expect(await db.admin.$count(employees)).toBe(SEED_COUNTS.employees)
    expect(await db.admin.$count(suppliers)).toBe(SEED_COUNTS.suppliers)
    expect(await db.admin.$count(products)).toBe(SEED_COUNTS.products)
    expect(await db.admin.$count(orders)).toBe(SEED_COUNTS.orders)
  })

  it("creates 1-25 detail rows per order via the weighted `with`", async () => {
    const detailCount = await db.admin.$count(details)
    expect(detailCount).toBeGreaterThanOrEqual(SEED_COUNTS.orders)
    expect(detailCount).toBeLessThanOrEqual(SEED_COUNTS.orders * 25)
  })

  it("wires every order to a real customer and employee (FK integrity)", async () => {
    const orphanCustomer = await db.admin
      .select({ id: orders.id })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(isNull(customers.id))
    const orphanEmployee = await db.admin
      .select({ id: orders.id })
      .from(orders)
      .leftJoin(employees, eq(orders.employeeId, employees.id))
      .where(isNull(employees.id))
    expect(orphanCustomer).toHaveLength(0)
    expect(orphanEmployee).toHaveLength(0)
  })

  it("wires every detail to a real order and product (FK integrity)", async () => {
    const orphanOrder = await db.admin
      .select({ orderId: details.orderId })
      .from(details)
      .leftJoin(orders, eq(details.orderId, orders.id))
      .where(isNull(orders.id))
    const orphanProduct = await db.admin
      .select({ productId: details.productId })
      .from(details)
      .leftJoin(products, eq(details.productId, products.id))
      .where(isNull(products.id))
    expect(orphanOrder).toHaveLength(0)
    expect(orphanProduct).toHaveLength(0)
  })

  it("applies the phone-number template generator", async () => {
    const rows = await db.admin
      .select({ phone: customers.phone })
      .from(customers)
      .limit(1)
    expect(rows[0]?.phone).toMatch(PHONE_TEMPLATE)
  })
})
