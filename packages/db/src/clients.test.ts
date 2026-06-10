import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type MockTransaction = (tx: {
  execute: (query: unknown) => unknown
}) => Promise<unknown>

function resetClientModuleMocks() {
  vi.resetModules()
  vi.doUnmock("drizzle-orm/postgres-js")
  vi.doUnmock("postgres")
}

beforeEach(() => {
  resetClientModuleMocks()
})

afterEach(() => {
  resetClientModuleMocks()
})

describe("getDrizzleSupabaseClient", () => {
  it("resolves Supabase claims before opening the RLS transaction", async () => {
    const events: string[] = []
    const tx = {
      execute: vi.fn((_query: unknown) => {
        events.push("execute")
      }),
    }
    const adminClient = {}
    const rlsClient = {
      transaction: vi.fn(async (transaction: MockTransaction) => {
        events.push("transaction-start")
        return await transaction(tx)
      }),
    }

    vi.doMock("postgres", () => ({
      default: vi.fn(() => ({
        end: vi.fn(async () => undefined),
      })),
    }))
    vi.doMock("drizzle-orm/postgres-js", () => ({
      drizzle: vi
        .fn()
        .mockReturnValueOnce(adminClient)
        .mockReturnValueOnce(rlsClient),
    }))

    const { createDrizzleClients } = await import("./clients.ts")
    const clients = createDrizzleClients({
      connectionString: "postgresql://postgres:postgres@localhost/postgres",
      schema: {},
    })
    const supabase = {
      auth: {
        getClaims: vi.fn(() => {
          events.push("claims")
          return Promise.resolve({
            data: {
              claims: {
                role: "authenticated",
                sub: "00000000-0000-0000-0000-000000000000",
              },
            },
            error: null,
          })
        }),
      },
    }

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

describe("createSupabaseDrizzle pool sharing", () => {
  it("reference-counts shared pools so close() only ends them once the last handle closes", async () => {
    const end = vi.fn(async () => undefined)
    vi.doMock("postgres", () => ({
      default: vi.fn(() => ({ end })),
    }))
    vi.doMock("drizzle-orm/postgres-js", () => ({
      drizzle: vi.fn(() => ({})),
    }))

    const { createSupabaseDrizzle } = await import("./clients.ts")
    const connectionString = "postgresql://postgres:postgres@localhost/postgres"
    // Same schema object + connection config -> the two handles share pools.
    const schema = {}
    const first = createSupabaseDrizzle({ connectionString, schema })
    const second = createSupabaseDrizzle({ connectionString, schema })

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
