import { beforeEach, describe, expect, it, vi } from "vitest"

// Use the REAL postgres driver and REAL drizzle here — postgres-js connects
// lazily, so a pool can be built and `end()`ed without a running server. We
// only intercept the factory (a counting passthrough) to observe the pool
// caching and reference-counted close() that live in clients.ts. Behavioral
// concerns (RLS, role/claims, query replay) are covered by the integration
// suite in test/rls.integration.test.ts, which runs against real Postgres.
const { postgresSpy, endSpies } = vi.hoisted(() => ({
  endSpies: [] as ReturnType<typeof vi.fn>[],
  postgresSpy: vi.fn(),
}))

vi.mock("postgres", async (importOriginal) => {
  const actual = await importOriginal<{ default: typeof import("postgres") }>()
  return {
    default: (url: string, options?: unknown) => {
      postgresSpy(url, options)
      const client = actual.default(url, options as never)
      const realEnd = client.end.bind(client)
      const end = vi.fn((opts?: { timeout?: number }) => realEnd(opts))
      client.end = end as typeof client.end
      endSpies.push(end)
      return client
    },
  }
})

import { createAdminClient } from "./clients.ts"

// Pools are cached by connection string, so each test uses a fresh URL to stay
// isolated; the pool-sharing tests deliberately reuse one URL.
let urlCounter = 0
function url() {
  urlCounter += 1
  return `postgresql://postgres:postgres@localhost/db${urlCounter}`
}

beforeEach(() => {
  postgresSpy.mockClear()
  endSpies.length = 0
})

describe("createAdminClient", () => {
  it("exposes close", () => {
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
    const shared = url()

    createAdminClient({ connectionString: shared })
    createAdminClient({ connectionString: shared })

    expect(postgresSpy).toHaveBeenCalledTimes(1)
  })

  it("reference-counts the shared pool so close() ends it once the last handle closes", async () => {
    const shared = url()

    const first = createAdminClient({ connectionString: shared })
    const second = createAdminClient({ connectionString: shared })

    // One underlying pool was created for the shared connection string.
    expect(endSpies).toHaveLength(1)
    const end = endSpies[0]

    expect(end).not.toHaveBeenCalled()

    await first.close()
    // Second handle still shares the pool — it must stay open.
    expect(end).not.toHaveBeenCalled()

    await second.close()
    // Last handle closed -> pool ended exactly once.
    expect(end).toHaveBeenCalledTimes(1)

    // Closing again is a no-op (does not re-end an already-closed pool).
    await second.close()
    expect(end).toHaveBeenCalledTimes(1)
  })
})
