import { DrizzleQueryError } from "drizzle-orm"
import postgres from "postgres"
import { describe, expect, it } from "vitest"
import { isConstraintViolation, SqlState, toPostgresError } from "./errors.ts"

// postgres.js builds its errors from a server message; this is that shape,
// constructed directly so no server is needed.
const postgresError = (fields: Partial<Record<string, string>>) =>
  Object.assign(new postgres.PostgresError(fields.message ?? "failed"), fields)

// What Drizzle throws: the driver error as `cause`, `code` undefined.
const wrapped = (cause: Error) =>
  new DrizzleQueryError("insert into contacts …", [], cause)

const duplicate = postgresError({
  code: SqlState.uniqueViolation,
  constraint_name: "contacts_email_key",
  message: "duplicate key value violates unique constraint",
})

// A minifier renames postgres.js's class, and the error takes its name from
// `this.constructor.name`, so a production bundle's error is named "a".
const MinifiedPostgresError = Object.defineProperty(
  class extends postgres.PostgresError {},
  "name",
  { value: "a" }
)

const minifiedDuplicate = Object.assign(new MinifiedPostgresError("failed"), {
  code: SqlState.uniqueViolation,
  constraint_name: "contacts_email_key",
  message: "duplicate key value violates unique constraint",
  severity: "ERROR",
  severity_local: "ERROR",
})

describe("toPostgresError", () => {
  it("unwraps Drizzle's DrizzleQueryError", () => {
    const error = wrapped(duplicate)

    expect((error as { code?: string }).code).toBeUndefined()
    expect(toPostgresError(error)).toBe(duplicate)
  })

  it("unwraps a second level, as a failed transaction nests", () => {
    const outer = Object.assign(new Error("transaction failed"), {
      cause: wrapped(duplicate),
    })

    expect(toPostgresError(outer)).toBe(duplicate)
  })

  it("returns the error itself when it is already one", () => {
    expect(toPostgresError(duplicate)).toBe(duplicate)
  })

  it("returns undefined for anything else", () => {
    expect(toPostgresError(new Error("nope"))).toBeUndefined()
    expect(toPostgresError("nope")).toBeUndefined()
    expect(toPostgresError(undefined)).toBeUndefined()
  })

  it("recognises a minified build's error by its shape", () => {
    expect(minifiedDuplicate.name).toBe("a")
    expect(toPostgresError(wrapped(minifiedDuplicate))).toBe(minifiedDuplicate)
  })

  it("ignores errors that only share a code", () => {
    // A Node system error, five characters like a SQLSTATE.
    const systemError = Object.assign(new Error("write EPIPE"), {
      code: "EPIPE",
      errno: -32,
      syscall: "write",
    })
    // What postgres.js raises itself, with no server response behind it.
    const connectionClosed = Object.assign(
      new Error("write CONNECTION_CLOSED 127.0.0.1:5432"),
      { address: "127.0.0.1", code: "CONNECTION_CLOSED", port: 5432 }
    )
    const cancelledBeforeSent = Object.assign(
      new Error("57014: canceling statement due to user request"),
      { code: "57014" }
    )

    for (const error of [systemError, connectionClosed, cancelledBeforeSent]) {
      expect(toPostgresError(wrapped(error))).toBeUndefined()
    }
  })

  it("stops on a cyclic cause chain", () => {
    const a = new Error("a")
    const b = Object.assign(new Error("b"), { cause: a })
    Object.assign(a, { cause: b })

    expect(toPostgresError(a)).toBeUndefined()
  })
})

describe("isConstraintViolation", () => {
  it("matches any class 23 code by default", () => {
    expect(isConstraintViolation(wrapped(duplicate))).toBe(duplicate)

    const notNull = postgresError({ code: SqlState.notNullViolation })
    expect(isConstraintViolation(notNull)).toBe(notNull)
  })

  it("does not match other SQLSTATE classes", () => {
    const denied = postgresError({ code: SqlState.insufficientPrivilege })

    expect(isConstraintViolation(denied)).toBeUndefined()
    expect(isConstraintViolation(new Error("nope"))).toBeUndefined()
  })

  it("narrows to named constraints", () => {
    expect(
      isConstraintViolation(duplicate, new Set(["contacts_email_key"]))
    ).toBe(duplicate)
    expect(isConstraintViolation(duplicate, ["other_key"])).toBeUndefined()
    expect(
      isConstraintViolation(postgresError({ code: SqlState.uniqueViolation }), [
        "contacts_email_key",
      ])
    ).toBeUndefined()
  })

  it("matches a minified build's error by code and constraint", () => {
    const error = wrapped(minifiedDuplicate)
    const options = { code: SqlState.uniqueViolation }

    expect(isConstraintViolation(error, ["contacts_email_key"], options)).toBe(
      minifiedDuplicate
    )
  })

  it("narrows to one code", () => {
    expect(
      isConstraintViolation(duplicate, undefined, {
        code: SqlState.uniqueViolation,
      })
    ).toBe(duplicate)
    expect(
      isConstraintViolation(duplicate, ["contacts_email_key"], {
        code: SqlState.foreignKeyViolation,
      })
    ).toBeUndefined()
  })
})
