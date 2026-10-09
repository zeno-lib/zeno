// Recognising Postgres errors through Drizzle. Runtime code, not a test helper:
// mapping a unique violation to a form error is ordinary request handling.
import type { PostgresError } from "postgres"

/**
 * SQLSTATE codes worth naming. The full list is Postgres's "Error Codes"
 * appendix; these are the ones an application branches on.
 */
export const SqlState = {
  /** `check_violation`. */
  checkViolation: "23514",
  /** `exclusion_violation`. */
  exclusionViolation: "23P01",
  /** `foreign_key_violation`. */
  foreignKeyViolation: "23503",
  /** `insufficient_privilege`: an RLS policy or a missing grant refused it. */
  insufficientPrivilege: "42501",
  /**
   * `invalid_column_reference`, which is what an `ON CONFLICT` target that no
   * unique index can arbitrate raises. It is raised while the statement is
   * planned, so it fires on the first insert, not on the first conflict.
   */
  invalidColumnReference: "42P10",
  /** `not_null_violation`. */
  notNullViolation: "23502",
  /** `undefined_function`: a function missing, or called with the wrong signature. */
  undefinedFunction: "42883",
  /** `unique_violation`. */
  uniqueViolation: "23505",
} as const

export type SqlStateCode = (typeof SqlState)[keyof typeof SqlState]

/** SQLSTATE class 23, every `integrity_constraint_violation`. */
const INTEGRITY_CONSTRAINT_CLASS = "23"

// Drizzle wraps once, and a failure inside `db.transaction()` can nest one
// more level. The bound only stops a cyclic `cause` chain.
const MAX_CAUSE_DEPTH = 5

/** A SQLSTATE: five digits or upper-case letters. */
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/

/**
 * Whether `error` is a postgres.js server error, judged by its shape.
 *
 * The name is only a fast path. postgres.js names its errors after
 * `this.constructor.name`, and a minifier renames the class, so in a
 * production bundle the name can be `"a"`. `instanceof` misses as soon as
 * the tree holds a second copy of `postgres`. What holds everywhere is the
 * shape of the server's error response: a SQLSTATE `code` and the severity
 * field Postgres always sends (`S`, which postgres.js reads into
 * `severity_local`; the unlocalised `severity` only exists from 9.6).
 *
 * An error that only shares a `code` doesn't match: a Node system error
 * (`EPIPE`) and the errors postgres.js raises itself (`CONNECTION_CLOSED`, or
 * `57014` for a query cancelled before it was sent) carry no severity.
 */
const isPostgresError = (error: Error): error is PostgresError => {
  if (error.name === "PostgresError") {
    return true
  }

  const fields = error as Partial<Record<keyof PostgresError, unknown>>

  return (
    typeof fields.code === "string" &&
    SQLSTATE_PATTERN.test(fields.code) &&
    typeof fields.severity_local === "string"
  )
}

/**
 * The postgres.js error underneath whatever Drizzle threw, or `undefined`.
 *
 * Drizzle wraps **every** driver error in a `DrizzleQueryError` whose own
 * `code` is `undefined`, so `error.code === "23505"` is always false:
 *
 * ```
 * depth 0: DrizzleQueryError  code=undefined  "Failed query: insert into …"
 * depth 1: PostgresError      code=23505      "duplicate key value violates …"
 * ```
 *
 * Recognised by shape, not by `instanceof` or by `name`, so neither a second
 * copy of `postgres` in the tree nor a minified production build can make it
 * miss.
 */
export const toPostgresError = (error: unknown): PostgresError | undefined => {
  let current: unknown = error

  for (
    let depth = 0;
    current instanceof Error && depth < MAX_CAUSE_DEPTH;
    depth += 1
  ) {
    if (isPostgresError(current)) {
      return current
    }
    // `Error.cause` is ES2022, past this package's `lib`.
    current = (current as Error & { cause?: unknown }).cause
  }

  // biome-ignore lint/complexity/noUselessReturn: `noImplicitReturns` needs the explicit fall-through return.
  return
}

export type ConstraintViolationOptions = {
  /**
   * The SQLSTATE to require, e.g. `SqlState.uniqueViolation`. Defaults to any
   * code in class 23 (`integrity_constraint_violation`).
   */
  code?: string
}

/**
 * Whether `error` is an integrity-constraint violation, optionally one of the
 * named constraints. Returns the `PostgresError` so a caller can read its
 * `constraint_name` or `detail`, or `undefined` when it does not match.
 *
 * ```ts
 * try {
 *   await db.insert(contacts).values(row)
 * } catch (error) {
 *   if (isConstraintViolation(error, ["contacts_email_key"], { code: SqlState.uniqueViolation })) {
 *     return { error: "That email is already a contact" }
 *   }
 *   throw error
 * }
 * ```
 */
export const isConstraintViolation = (
  error: unknown,
  constraints?: Iterable<string>,
  { code }: ConstraintViolationOptions = {}
): PostgresError | undefined => {
  const postgresError = toPostgresError(error)

  if (!postgresError) {
    return
  }

  const matchesCode = code
    ? postgresError.code === code
    : postgresError.code.startsWith(INTEGRITY_CONSTRAINT_CLASS)

  if (!matchesCode) {
    return
  }

  if (constraints === undefined) {
    return postgresError
  }

  const name = postgresError.constraint_name

  if (name === undefined) {
    return
  }

  for (const constraint of constraints) {
    if (constraint === name) {
      return postgresError
    }
  }

  // biome-ignore lint/complexity/noUselessReturn: `noImplicitReturns` needs the explicit fall-through return.
  return
}
