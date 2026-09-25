import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createAdminClient, resolveDatabaseUrl } from "./clients.ts"

// Pure string checks: nothing here builds a pool or opens a socket, except the
// last test, which only reaches the check (it throws before `postgres()`).
const POOLER =
  "postgresql://postgres.ref:secret@aws-0-eu-central-1.pooler.supabase.com:6543/postgres"
const SESSION =
  "postgresql://postgres.ref:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres"
const LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres"

beforeEach(() => {
  vi.stubEnv("SUPABASE_DATABASE_URL", undefined)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("resolveDatabaseUrl", () => {
  it("prefers the override, then the environment", () => {
    vi.stubEnv("SUPABASE_DATABASE_URL", LOCAL)
    expect(resolveDatabaseUrl()).toBe(LOCAL)
    expect(resolveDatabaseUrl({ connectionString: POOLER })).toBe(POOLER)
  })

  it("throws when neither is set", () => {
    expect(() => resolveDatabaseUrl()).toThrow(
      "Missing SUPABASE_DATABASE_URL environment variable"
    )
  })

  it("accepts any URL without requirePooler, as before", () => {
    expect(resolveDatabaseUrl({ connectionString: LOCAL })).toBe(LOCAL)
    expect(resolveDatabaseUrl({ connectionString: SESSION })).toBe(SESSION)
  })

  it("accepts the transaction pooler with requirePooler", () => {
    expect(
      resolveDatabaseUrl({ connectionString: POOLER, requirePooler: true })
    ).toBe(POOLER)
  })

  it("rejects another port with requirePooler, without echoing the URL", () => {
    const check = () =>
      resolveDatabaseUrl({ connectionString: SESSION, requirePooler: true })

    expect(check).toThrow("port 6543), got port 5432")
    expect(check).not.toThrow("secret")
  })

  it("rejects a missing port with requirePooler", () => {
    expect(() =>
      resolveDatabaseUrl({
        connectionString: "postgresql://u:p@db.example.com/postgres",
        requirePooler: true,
      })
    ).toThrow("got port (default)")
  })

  it.each([
    LOCAL,
    "postgresql://u:p@localhost:6543/postgres",
    "postgresql://u:p@[::1]:6543/postgres",
  ])("rejects a local host with requirePooler: %s", (connectionString) => {
    expect(() =>
      resolveDatabaseUrl({ connectionString, requirePooler: true })
    ).toThrow("points at a local database")
  })

  it("rejects a non-postgres URL with requirePooler", () => {
    expect(() =>
      resolveDatabaseUrl({
        connectionString: "https://db.example.com:6543",
        requirePooler: true,
      })
    ).toThrow("must be a postgresql:// URL")
    expect(() =>
      resolveDatabaseUrl({ connectionString: "not a url", requirePooler: true })
    ).toThrow("is not a valid URL")
  })

  it("is what the factories run", () => {
    expect(() =>
      createAdminClient({ connectionString: LOCAL, requirePooler: true })
    ).toThrow("points at a local database")
  })
})
