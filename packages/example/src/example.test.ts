import { createDrizzleClients } from "@zeno-lib/db/clients"
import { eq, isNull, sql } from "drizzle-orm"
import { beforeAll, describe, expect, it, vi } from "vitest"
import {
  getDrizzleSupabaseAdminClient,
  getDrizzleSupabaseClient,
} from "./clients"
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

// Build an unsigned access_token whose payload decodes to `claims`.
function makeAccessToken(claims: Record<string, unknown>): string {
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(claims)}.signature`
}

// Package-level factory contract (the reusable engine in @zeno-lib/db).
describe("createDrizzleClients", () => {
  it("throws when DATABASE_URL is unset and no override is provided", () => {
    vi.stubEnv("DATABASE_URL", "")
    expect(() => createDrizzleClients({ schema: {} })).toThrow(
      "Missing DATABASE_URL environment variable"
    )
    vi.unstubAllEnvs()
  })

  it("accepts an explicit connectionString override", async () => {
    const clients = createDrizzleClients({
      connectionString: LOCAL_DB_URL,
      schema: {},
    })
    const result = await clients
      .getDrizzleSupabaseAdminClient()
      .execute(sql`select 1 as ok`)
    expect(result[0]).toEqual({ ok: 1 })
  })
})

// App-level getters (this package's own clients.ts, bound to its schema).
describe("getDrizzleSupabaseAdminClient", () => {
  it("bypasses RLS (runs as postgres)", async () => {
    const result = await getDrizzleSupabaseAdminClient().execute(
      sql`select current_user as role`
    )
    expect(result[0]).toEqual({ role: "postgres" })
  })
})

describe("getDrizzleSupabaseClient", () => {
  it("switches the role to the token's role inside runTransaction", async () => {
    const { runTransaction } = getDrizzleSupabaseClient(makeAccessToken(TOKEN))
    const result = await runTransaction((tx) =>
      tx.execute(sql`select current_user as role`)
    )
    expect(result[0]).toEqual({ role: "authenticated" })
  })

  it("sets request.jwt.claims (JSON) so auth.uid() resolves the sub", async () => {
    const { runTransaction } = getDrizzleSupabaseClient(makeAccessToken(TOKEN))
    const result = await runTransaction((tx) =>
      tx.execute(
        sql`select current_setting('request.jwt.claims', true) as claims, auth.uid() as uid`
      )
    )
    const row = result[0] as { claims: string; uid: string }
    expect(JSON.parse(row.claims)).toMatchObject(TOKEN)
    expect(row.uid).toBe(TOKEN.sub)
  })

  it("falls back to the anon role for an unknown/forged role claim", async () => {
    const { runTransaction } = getDrizzleSupabaseClient(
      makeAccessToken({ role: "postgres" })
    )
    const result = await runTransaction((tx) =>
      tx.execute(sql`select current_user as role`)
    )
    expect(result[0]).toEqual({ role: "anon" })
  })

  it("scopes role and claims to the transaction (does not leak)", async () => {
    const { runTransaction } = getDrizzleSupabaseClient(makeAccessToken(TOKEN))
    await runTransaction((tx) => tx.execute(sql`select 1`))
    // The admin pool is a separate connection — never role-switched, and the
    // claim was never set on it (null, not "").
    const result = await getDrizzleSupabaseAdminClient().execute(
      sql`select current_user as role, current_setting('request.jwt.claims', true) as claims`
    )
    expect(result[0]).toEqual({ claims: null, role: "postgres" })
  })

  it("applies RLS policies — non-matching sub returns 0 rows", async () => {
    const { runTransaction } = getDrizzleSupabaseClient(makeAccessToken(TOKEN))
    const rows = await runTransaction((tx) => tx.select().from(posts))
    expect(rows).toEqual([])
  })
})

describe("northwind seed", () => {
  const db = getDrizzleSupabaseAdminClient()

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
