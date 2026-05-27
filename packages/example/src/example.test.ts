import { createDb } from "@zeno-lib/db/client"
import { createDbForRequest } from "@zeno-lib/db/rls"
import { eq, isNull, sql } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
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

describe("northwind seed", () => {
  const schema = { customers, details, employees, orders, products, suppliers }
  const db = createDb({ schema })

  beforeAll(async () => {
    await seedDatabase(db)
  }, 60_000)

  it("inserts the configured number of rows per top-level table", async () => {
    expect(await db.$count(customers)).toBe(SEED_COUNTS.customers)
    expect(await db.$count(employees)).toBe(SEED_COUNTS.employees)
    expect(await db.$count(suppliers)).toBe(SEED_COUNTS.suppliers)
    expect(await db.$count(products)).toBe(SEED_COUNTS.products)
    expect(await db.$count(orders)).toBe(SEED_COUNTS.orders)
  })

  it("creates 1–25 detail rows per order via the weighted `with`", async () => {
    const detailCount = await db.$count(details)
    expect(detailCount).toBeGreaterThanOrEqual(SEED_COUNTS.orders)
    expect(detailCount).toBeLessThanOrEqual(SEED_COUNTS.orders * 25)
  })

  it("wires every order to a real customer and employee (FK integrity)", async () => {
    const orphanCustomer = await db
      .select({ id: orders.id })
      .from(orders)
      .leftJoin(customers, eq(orders.customerId, customers.id))
      .where(isNull(customers.id))
    const orphanEmployee = await db
      .select({ id: orders.id })
      .from(orders)
      .leftJoin(employees, eq(orders.employeeId, employees.id))
      .where(isNull(employees.id))
    expect(orphanCustomer).toHaveLength(0)
    expect(orphanEmployee).toHaveLength(0)
  })

  it("wires every detail to a real order and product (FK integrity)", async () => {
    const orphanOrder = await db
      .select({ orderId: details.orderId })
      .from(details)
      .leftJoin(orders, eq(details.orderId, orders.id))
      .where(isNull(orders.id))
    const orphanProduct = await db
      .select({ productId: details.productId })
      .from(details)
      .leftJoin(products, eq(details.productId, products.id))
      .where(isNull(products.id))
    expect(orphanOrder).toHaveLength(0)
    expect(orphanProduct).toHaveLength(0)
  })

  it("applies the phone-number template generator", async () => {
    const rows = await db
      .select({ phone: customers.phone })
      .from(customers)
      .limit(1)
    expect(rows[0]?.phone).toMatch(PHONE_TEMPLATE)
  })
})
