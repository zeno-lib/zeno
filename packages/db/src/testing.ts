// Test helpers for suites that run against a real database. They throw instead
// of calling `expect`, so they work under any test runner.
import type { PostgresError } from "postgres"
import { SqlState, toPostgresError } from "./errors.ts"

/**
 * Anything with Drizzle's async `transaction`, a database or a transaction of
 * any dialect, whose callback gets a `TTx`.
 */
type Transactional<TTx> = {
  transaction: <T>(run: (tx: TTx) => Promise<T>) => Promise<T>
}

/**
 * Thrown once `run` is done, so nothing it wrote ever commits. Private, so a
 * `tx.rollback()` inside `run`, which throws Drizzle's own
 * `TransactionRollbackError`, still reaches the caller.
 */
class Rollback extends Error {}

// Drizzle can wrap what the callback threw. The bound only stops a cyclic
// `cause` chain.
const MAX_CAUSE_DEPTH = 5

const isRollback = (error: unknown): boolean => {
  let current: unknown = error

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (current instanceof Rollback) {
      return true
    }
    if (!(current instanceof Error)) {
      return false
    }
    // `Error.cause` is ES2022, past this package's `lib`.
    current = (current as Error & { cause?: unknown }).cause
  }

  return false
}

/**
 * Runs `run` in a transaction on `db` that always rolls back, and resolves to
 * what `run` returned. An error `run` throws is rethrown.
 *
 * For tests on a shared database: when suites run in parallel, a committed row
 * changes what every other suite counts. Nothing written here is visible
 * outside the transaction, and nothing needs cleaning up, whatever the rows
 * cascade into. On a transaction, it runs in a savepoint.
 *
 * ```ts
 * it("archives a deal", () =>
 *   rollBackAfter(db, async (tx) => {
 *     const [deal] = await tx.insert(deals).values({ name: "Acme" }).returning()
 *     await archiveDeal(tx, deal.id)
 *     expect(await tx.query.deals.findFirst({ where: { id: deal.id } })).toBeUndefined()
 *   }))
 * ```
 */
export const rollBackAfter = async <TTx, T>(
  db: Transactional<TTx>,
  run: (tx: TTx) => Promise<T>
): Promise<T> => {
  let result: T | undefined

  await db
    .transaction(async (tx) => {
      result = await run(tx)
      throw new Rollback()
    })
    .catch((error: unknown) => {
      if (!isRollback(error)) {
        throw error
      }
    })

  return result as T
}

/** A query, or a function that starts one, so a synchronous throw counts too. */
type Query = PromiseLike<unknown> | (() => PromiseLike<unknown>)

const describeValue = (value: unknown): string => {
  try {
    // `JSON.stringify` gives `undefined` for `undefined`, whatever its type says.
    return String(JSON.stringify(value))
  } catch {
    // A `bigint`, or a cycle.
    return String(value)
  }
}

/**
 * Asserts a query fails with a given SQLSTATE (`SqlState` from
 * `@zeno-lib/db/errors`), and resolves to the error so a caller can check its
 * `table_name`, `constraint_name` or message.
 *
 * It rejects when the query succeeds, which a bare `try`/`catch` does not,
 * and when it fails with another code or with an error the server didn't send.
 *
 * ```ts
 * const error = await expectPostgresError(
 *   tx.insert(contacts).values(duplicate),
 *   SqlState.uniqueViolation
 * )
 * expect(error.constraint_name).toBe("contacts_email_key")
 * ```
 *
 * A failed statement aborts the transaction it ran in, so make it the last
 * statement of a `rollBackAfter`, or wrap it in `tx.transaction` to run it in
 * a savepoint.
 */
export const expectPostgresError = async (
  query: Query,
  code: string
): Promise<PostgresError> => {
  const caught = await Promise.resolve()
    .then(() => (typeof query === "function" ? query() : query))
    .then(
      (value) => {
        throw new Error(
          `Expected Postgres error ${code}, but the query resolved with ${describeValue(value)}`
        )
      },
      (error: unknown) => error
    )
  const postgresError = toPostgresError(caught)

  if (postgresError?.code !== code) {
    const message = caught instanceof Error ? caught.message : String(caught)
    throw new Error(
      `Expected Postgres error ${code}, got ${postgresError?.code ?? "no PostgresError"}: ${message}`
    )
  }

  return postgresError
}

/**
 * Asserts a query is refused by a row-level security policy or a missing
 * grant (`insufficient_privilege`, `42501`).
 *
 * A `select` that RLS filters doesn't fail, it returns fewer rows; assert on
 * those instead.
 */
export const expectRlsDenied = (query: Query): Promise<PostgresError> =>
  expectPostgresError(query, SqlState.insufficientPrivilege)
