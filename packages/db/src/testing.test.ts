import { DrizzleQueryError } from "drizzle-orm"
import postgres from "postgres"
import { describe, expect, it } from "vitest"
import { SqlState } from "./errors.ts"
import { expectPostgresError, expectRlsDenied } from "./testing.ts"

// postgres.js builds its errors from a server message's parsed fields; this
// constructs one directly so no server is needed.
const PostgresError = postgres.PostgresError as unknown as new (
  fields: Record<string, string>
) => postgres.PostgresError

// What Drizzle throws for a refused write: the driver error as `cause`.
const denied = new PostgresError({
  code: SqlState.insufficientPrivilege,
  message: 'new row violates row-level security policy for table "posts"',
  severity: "ERROR",
  severity_local: "ERROR",
})
const deniedQuery = () =>
  Promise.reject(new DrizzleQueryError("insert into posts …", [], denied))

describe("expectPostgresError", () => {
  it("rejects when the query succeeds", async () => {
    await expect(expectRlsDenied(Promise.resolve([{ id: 1 }]))).rejects.toThrow(
      'but the query resolved with [{"id":1}]'
    )
  })

  it("rejects when the query fails with another code", async () => {
    await expect(
      expectPostgresError(deniedQuery(), SqlState.uniqueViolation)
    ).rejects.toThrow(
      "Expected Postgres error 23505, got 42501: new row violates row-level security policy"
    )
  })

  it("rejects when the error didn't come from the server", async () => {
    await expect(
      expectRlsDenied(Promise.reject(new Error("connection closed")))
    ).rejects.toThrow("got no PostgresError: connection closed")
  })

  it("resolves to the driver error under Drizzle's wrapper", async () => {
    expect(await expectRlsDenied(deniedQuery())).toBe(denied)
  })

  it("catches what a query function throws before it returns a promise", async () => {
    const error = await expectRlsDenied(() => {
      throw new DrizzleQueryError("insert into posts …", [], denied)
    })

    expect(error).toBe(denied)
  })
})
