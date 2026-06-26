import { beforeEach, describe, expect, it, vi } from "vitest"

// Hoisted module mocks: set up before any import so they always apply (no
// resetModules/dynamic-import race). Each test configures the return values.
const { drizzleMock, postgresDefault } = vi.hoisted(() => ({
  drizzleMock: vi.fn(),
  postgresDefault: vi.fn(),
}))

vi.mock("postgres", () => ({ default: postgresDefault }))
vi.mock("drizzle-orm/postgres-js", () => ({ drizzle: drizzleMock }))

import type { SupabaseClient } from "@supabase/supabase-js"
import { sql } from "drizzle-orm"
import {
  createAdminClient,
  createAnonClient,
  createAuthClient,
  createServiceClient,
  createSupabaseClient,
  type SupabaseToken,
} from "./clients.ts"

// Pools are cached by connection string, so each test uses a fresh URL to stay
// isolated; the pool-sharing tests deliberately reuse one URL.
let urlCounter = 0
function url() {
  urlCounter += 1
  return `postgresql://postgres:postgres@localhost/db${urlCounter}`
}

const TOKEN: SupabaseToken = {
  role: "authenticated",
  sub: "00000000-0000-0000-0000-000000000000",
}

beforeEach(() => {
  drizzleMock.mockReset()
  postgresDefault.mockReset()
  // Default postgres pool stub; tests that assert on `end` override this.
  postgresDefault.mockReturnValue({ end: vi.fn(async () => undefined) })
})

// Builds the rls drizzle client whose `transaction` records the query chain into
// `events`, plus a `tx` that records each step. Wires it onto `drizzleMock`.
function mockRlsDrizzle() {
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
  const db = {
    transaction: vi.fn(async (transaction: (tx: unknown) => unknown) => {
      events.push("transaction-start")
      return await transaction(tx)
    }),
  }
  drizzleMock.mockReturnValue(db)
  return { db, events, findManyResult, selectResult, tx }
}

function mockAdminDrizzle() {
  const adminSelectResult = [{ id: "admin-select" }]
  const db = {
    select: vi.fn(() => ({ from: vi.fn(() => adminSelectResult) })),
  }
  drizzleMock.mockReturnValue(db)
  return { adminSelectResult, db }
}

function mockSupabase(
  role = "authenticated",
  events?: string[]
): SupabaseClient {
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
  } as unknown as SupabaseClient
}

describe("createAuthClient (RLS context)", () => {
  it("resolves Supabase claims before opening the RLS transaction", async () => {
    const { events } = mockRlsDrizzle()
    const db = createAuthClient(mockSupabase("authenticated", events), {
      connectionString: url(),
    })

    await db.transaction(() => {
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

describe("createSupabaseClient (direct RLS query client)", () => {
  it("records and replays a select() chain inside one RLS transaction", async () => {
    const { events, selectResult } = mockRlsDrizzle()
    const db = createSupabaseClient(TOKEN, { connectionString: url() })

    const rows = await db.select().from({} as never)

    expect(rows).toBe(selectResult)
    // The transaction sets RLS context (2 execute calls) before the recorded
    // select().from() chain is replayed on `tx`. No `getClaims` is called — the
    // token is supplied directly.
    expect(events).toEqual([
      "transaction-start",
      "execute",
      "execute",
      "select",
      "from",
    ])
  })

  it("replays the relational query API (db.query.table.findMany)", async () => {
    const { events, findManyResult } = mockRlsDrizzle()
    const db = createSupabaseClient(TOKEN, { connectionString: url() })

    const rows = await (
      db as unknown as {
        query: { posts: { findMany: () => Promise<unknown> } }
      }
    ).query.posts.findMany()

    expect(rows).toBe(findManyResult)
    expect(events).toContain("findMany")
    // The relational chain still runs inside the role-switched transaction.
    expect(events.indexOf("execute")).toBeLessThan(events.indexOf("findMany"))
  })

  it("forwards the relations object to drizzle", () => {
    mockRlsDrizzle()
    const relations = { posts: {} } as never
    createSupabaseClient(TOKEN, { connectionString: url(), relations })

    expect(drizzleMock).toHaveBeenCalledWith(
      expect.objectContaining({ relations })
    )
  })
})

describe("createAnonClient / createServiceClient", () => {
  it("runs multiple statements under one role-switched transaction via db.transaction", async () => {
    const { events } = mockRlsDrizzle()
    const db = createAnonClient({ connectionString: url() })

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select 1`)
      return "ok"
    })

    expect(result).toBe("ok")
    // Two execute calls set the RLS context, then the user's statement runs.
    expect(events.filter((event) => event === "execute")).toHaveLength(3)
  })

  it("exposes a directly-queryable service client", async () => {
    const { events, selectResult } = mockRlsDrizzle()
    const db = createServiceClient({ connectionString: url() })

    const rows = await db.select().from({} as never)

    expect(rows).toBe(selectResult)
    expect(events).toEqual([
      "transaction-start",
      "execute",
      "execute",
      "select",
      "from",
    ])
  })
})

describe("createAdminClient (RLS-bypassing query client)", () => {
  it("queries directly without a Supabase client", async () => {
    const { adminSelectResult } = mockAdminDrizzle()
    const db = createAdminClient({ connectionString: url() })

    const rows = await db.select().from({} as never)

    expect(rows).toBe(adminSelectResult)
  })

  it("exposes close", () => {
    mockAdminDrizzle()
    const db = createAdminClient({ connectionString: url() })

    expect(db.close).toEqual(expect.any(Function))
  })

  it("throws when SUPABASE_DATABASE_URL is unset and no override is provided", () => {
    vi.stubEnv("SUPABASE_DATABASE_URL", "")
    expect(() => createAdminClient()).toThrow(
      "Missing SUPABASE_DATABASE_URL environment variable"
    )
    vi.unstubAllEnvs()
  })
})

describe("pool sharing", () => {
  it("creates one pool per connection string", () => {
    drizzleMock.mockImplementation(() => ({}))
    const shared = url()

    createAdminClient({ connectionString: shared })
    createAdminClient({ connectionString: shared })

    expect(postgresDefault).toHaveBeenCalledTimes(1)
  })

  it("reference-counts the shared pool so close() ends it once the last handle closes", async () => {
    const end = vi.fn(async () => undefined)
    postgresDefault.mockReturnValue({ end })
    // Fresh drizzle instance per handle so each gets its own `close`.
    drizzleMock.mockImplementation(() => ({}))
    const shared = url()

    const first = createAdminClient({ connectionString: shared })
    const second = createAdminClient({ connectionString: shared })

    expect(end).not.toHaveBeenCalled()

    await first.close({ timeout: 0 })
    // Second handle still shares the pool — it must stay open.
    expect(end).not.toHaveBeenCalled()

    await second.close({ timeout: 0 })
    // Last handle closed -> pool ended exactly once.
    expect(end).toHaveBeenCalledTimes(1)

    // Closing again is a no-op (does not re-end an already-closed pool).
    await second.close({ timeout: 0 })
    expect(end).toHaveBeenCalledTimes(1)
  })
})
