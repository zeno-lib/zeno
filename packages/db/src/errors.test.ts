import { DrizzleQueryError } from "drizzle-orm"
import postgres from "postgres"
import { describe, expect, it } from "vitest"
import { isConstraintViolation, SqlState, toPostgresError } from "./errors.ts"

// postgres.js builds its errors from a server message; this is that shape,
// constructed directly so no server is needed.
const postgresError = (fields: Record<string, string>) =>
  Object.assign(new postgres.PostgresError(fields.message ?? "failed"), fields)

// What Drizzle throws: the driver error as `cause`, `code` undefined.
const wrapped = (cause: Error) =>
  new DrizzleQueryError("insert into contacts …", [], cause)

const duplicate = postgresError({
  code: SqlState.uniqueViolation,
  constraint_name: "contacts_email_key",
  message: "duplicate key value violates unique constraint",
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
