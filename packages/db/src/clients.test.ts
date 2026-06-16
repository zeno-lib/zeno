import { beforeEach, describe, expect, it, vi } from "vitest"

// Hoisted module mocks: set up before any import so they always apply (no
// resetModules/dynamic-import race). Each test configures the return values.
const { drizzleMock, postgresDefault } = vi.hoisted(() => ({
  drizzleMock: vi.fn(),
  postgresDefault: vi.fn(),
}))

vi.mock("postgres", () => ({ default: postgresDefault }))
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: drizzleMock }))

import { createDrizzleClients, createSupabaseDrizzle } from "./clients.ts"

const CONNECTION = "postgresql://postgres:postgres@localhost/postgres"

type MockTransaction = (tx: {
  execute: (query: unknown) => unknown
}) => Promise<unknown>

beforeEach(() => {
  drizzleMock.mockReset()
  postgresDefault.mockReset()
  // Default postgres pool stub; tests that assert on `end` override this.
  postgresDefault.mockReturnValue({ end: vi.fn(async () => undefined) })
})

// Builds the admin + rls clients returned by the two `drizzle()` calls in
// `createDrizzleClients`, plus a `tx` that records the query chain into
// `events`. Wires them onto `drizzleMock` (admin first, rls second).
function mockClients() {
  const events: string[] = []
  const selectResult = [{ id: "select" }]
  const findManyResult = [{ id: "findMany" }]
  const tx = {
    execute: vi.fn(() => {
      events.push("execute")
    }),
    query: {
      posts: {
        findMany: vi.fn(() => {
          events.push("findMany")
          return findManyResult
        }),
      },
    },
    select: vi.fn(() => {
      events.push("select")
      return {
        from: vi.fn(() => {
          events.push("from")
          return selectResult
        }),
      }
    }),
  }
  const adminClient = {}
  const rlsClient = {
    transaction: vi.fn(async (transaction: (tx: unknown) => unknown) => {
      events.push("transaction-start")
      return await transaction(tx)
    }),
  }
  drizzleMock.mockReturnValueOnce(adminClient).mockReturnValueOnce(rlsClient)
  return { adminClient, events, findManyResult, rlsClient, selectResult, tx }
}

function mockSupabase(role = "authenticated", events?: string[]) {
  return {
    auth: {
      getClaims: vi.fn(() => {
        events?.push("claims")
        return Promise.resolve({
          data: {
            claims: { role, sub: "00000000-0000-0000-0000-000000000000" },
          },
          error: null,
        })
      }),
    },
  }
}

describe("getDrizzleSupabaseClient", () => {
  it("resolves Supabase claims before opening the RLS transaction", async () => {
    const events: string[] = []
    const tx = {
      execute: vi.fn(() => {
        events.push("execute")
      }),
    }
    drizzleMock.mockReturnValueOnce({}).mockReturnValueOnce({
      transaction: vi.fn(async (transaction: MockTransaction) => {
        events.push("transaction-start")
        return await transaction(tx)
      }),
    })

    const clients = createDrizzleClients({
      connectionString: CONNECTION,
      schema: {},
    })
    const supabase = mockSupabase("authenticated", events)

    await clients.getDrizzleSupabaseClient(supabase).runTransaction(() => {
      events.push("callback")
      return Promise.resolve()
    })

    expect(events).toEqual([
      "claims",
      "transaction-start",
      "execute",
      "execute",
      "callback",
    ])
  })
})

describe("createSupabaseDrizzle chainable asUser", () => {
  it("records and replays a select() chain inside one RLS transaction", async () => {
    const { events, selectResult } = mockClients()
    const db = createSupabaseDrizzle({
      connectionString: CONNECTION,
      schema: {},
      supabase: mockSupabase(),
    })

    const rows = await db.asUser.select().from({} as never)

    expect(rows).toBe(selectResult)
    // The transaction sets RLS context (2 execute calls) before the recorded
    // select().from() chain is replayed on `tx`.
    expect(events).toEqual([
      "transaction-start",
      "execute",
      "execute",
      "select",
      "from",
    ])
  })

  it("replays the relational query API (db.asUser.query.table.findMany)", async () => {
    const { events, findManyResult } = mockClients()
    const db = createSupabaseDrizzle({
      connectionString: CONNECTION,
      schema: {},
      supabase: mockSupabase(),
    })

    const rows = await (
      db.asUser as unknown as {
        query: { posts: { findMany: () => Promise<unknown> } }
      }
    ).query.posts.findMany()

    expect(rows).toBe(findManyResult)
    expect(events).toContain("findMany")
    // The relational chain still runs inside the role-switched transaction.
    expect(events.indexOf("execute")).toBeLessThan(events.indexOf("findMany"))
  })

  it("rejects when no Supabase client was provided", async () => {
    mockClients()
    const db = createSupabaseDrizzle({
      connectionString: CONNECTION,
      schema: {},
    })

    await expect(db.asUser.select().from({} as never)).rejects.toThrow(
      "Missing Supabase client"
    )
  })

  it("throws a helpful error if db.asUser is called like the old callback form", () => {
    mockClients()
    const db = createSupabaseDrizzle({
      connectionString: CONNECTION,
      schema: {},
      supabase: mockSupabase(),
    })

    expect(() => (db.asUser as unknown as () => void)()).toThrow(
      "db.asUser is chainable"
    )
  })

  it("forwards the relations object to drizzle", () => {
    mockClients()
    const relations = { posts: {} } as never
    createSupabaseDrizzle({
      connectionString: CONNECTION,
      relations,
      schema: {},
      supabase: mockSupabase(),
    })

    expect(drizzleMock).toHaveBeenCalledWith(
      expect.objectContaining({ relations })
    )
  })
})

describe("createSupabaseDrizzle pool sharing", () => {
  it("reference-counts shared pools so close() only ends them once the last handle closes", async () => {
    const end = vi.fn(async () => undefined)
    postgresDefault.mockReturnValue({ end })
    drizzleMock.mockReturnValue({})

    // Same schema object + connection config -> the two handles share pools.
    const schema = {}
    const first = createSupabaseDrizzle({
      connectionString: CONNECTION,
      schema,
    })
    const second = createSupabaseDrizzle({
      connectionString: CONNECTION,
      schema,
    })

    // Two pools (admin + rls) created once, not once per handle.
    expect(end).not.toHaveBeenCalled()

    await first.close({ timeout: 0 })
    // Second handle still shares the pools — they must stay open.
    expect(end).not.toHaveBeenCalled()

    await second.close({ timeout: 0 })
    // Last handle closed -> both pools ended exactly once.
    expect(end).toHaveBeenCalledTimes(2)

    // Closing again is a no-op (does not re-end already-closed pools).
    await second.close({ timeout: 0 })
    expect(end).toHaveBeenCalledTimes(2)
  })
})
