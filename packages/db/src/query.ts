// Query-side helpers: the PostgREST conveniences Drizzle has no equivalent for
// (`.single()`, `.maybeSingle()`, a default upsert `set`), plus the read side
// of `functionPolicies`.
import { getColumns, is, type SQL, sql } from "drizzle-orm"
import { getTableConfig, PgTable } from "drizzle-orm/pg-core"
import {
  DEFAULT_FUNCTION_PREFIX,
  FUNCTION_POLICY_OPERATIONS,
  type FunctionPolicyOperation,
  functionPolicyName,
} from "./function-names.ts"

/**
 * PostgREST's `.single()`: exactly one row, or an error.
 *
 * `findFirst()` returns `undefined` for no rows and silently drops the rest
 * when there are several, and `.returning()` hands back an array.
 */
export const one = <T>(rows: readonly T[]): T => {
  if (rows.length !== 1) {
    throw new Error(`Expected exactly one row, received ${rows.length}`)
  }

  return rows[0] as T
}

/**
 * PostgREST's `.maybeSingle()`: one row or none, erroring on more than one.
 * Returns `undefined` rather than `null`, which is what `findFirst()` does.
 */
export const maybeOne = <T>(rows: readonly T[]): T | undefined => {
  if (rows.length > 1) {
    throw new Error(`Expected at most one row, received ${rows.length}`)
  }

  return rows[0]
}

type ColumnKey<TTable extends PgTable> = Extract<
  keyof TTable["_"]["columns"],
  string
>

export type ExcludedSetOptions<TTable extends PgTable> = {
  /**
   * The conflict target's column keys, never written back from `excluded`.
   * The first one that exists is also the empty-set fallback. Default `"id"`.
   */
  target?: ColumnKey<TTable> | readonly ColumnKey<TTable>[]
}

/**
 * The `set` for `onConflictDoUpdate` that reproduces PostgREST's
 * `.upsert(row, { onConflict })`: on conflict, every column the caller
 * supplied is overwritten from the proposed row (`col = excluded.col`).
 *
 * - A key carrying `undefined` is skipped. Drizzle omits an undefined column
 *   from the INSERT, so `excluded.x` would be the column default, and on a
 *   conflict `x = excluded.x` would overwrite a stored value with it.
 * - The conflict target (`id` unless `target` says otherwise) is excluded.
 * - An empty result falls back to `<target> = excluded.<target>`. Drizzle
 *   throws `No values to set` while *building* the statement, so a payload
 *   holding nothing but the key would fail even on the plain insert path.
 *   Writing the key back to itself is a no-op that keeps `.returning()`
 *   yielding the row, which `onConflictDoNothing` does not.
 *
 * With no target column in the table (a junction keyed only by its foreign
 * keys, with the default target) the fallback cannot apply and the result
 * stays empty: such a table wants `onConflictDoNothing` anyway.
 *
 * Column names come from the schema, never from `values`.
 */
export const excludedSet = <TTable extends PgTable>(
  table: TTable,
  values: Record<string, unknown>,
  { target = "id" as ColumnKey<TTable> }: ExcludedSetOptions<TTable> = {}
): Record<string, SQL> => {
  const columns: Record<string, { name: string }> = getColumns(table)
  const targets: readonly string[] =
    typeof target === "string" ? [target] : target
  const set: Record<string, SQL> = {}

  for (const [key, column] of Object.entries(columns)) {
    if (key in values && values[key] !== undefined && !targets.includes(key)) {
      set[key] = sql`excluded.${sql.identifier(column.name)}`
    }
  }

  if (Object.keys(set).length > 0) {
    return set
  }

  const fallback = targets.find((key) => key in columns)
  const fallbackColumn = fallback === undefined ? undefined : columns[fallback]

  if (fallback !== undefined && fallbackColumn) {
    set[fallback] = sql`excluded.${sql.identifier(fallbackColumn.name)}`
  }

  return set
}

/**
 * The same values with every `undefined` key dropped, so an insert and its
 * `excludedSet` agree on which columns were supplied.
 */
export const definedValues = <T extends Record<string, unknown>>(
  values: T
): T =>
  Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== undefined)
  ) as T

/** Table name to the schema its `<prefix>_<operation>_<table>` functions live in. */
export type FunctionPermissionTables = ReadonlyMap<string, string>

export type FunctionPermissionTablesOptions = {
  /** Schemas whose tables are included. Default `["public"]`. */
  schemas?: readonly string[]
}

const DEFAULT_SCHEMA = "public"

// A schema module exports tables directly; `defineRelations` wraps each in
// `{ table, name, relations }`. Both are accepted so either object works.
const tableOf = (value: unknown): PgTable | undefined => {
  if (is(value, PgTable)) {
    return value
  }
  if (typeof value === "object" && value !== null && "table" in value) {
    const { table } = value
    return is(table, PgTable) ? table : undefined
  }
  return
}

/**
 * The allowlist `selectFunctionPermissions` resolves a table name against,
 * built from a Drizzle schema object (`import * as schema`) or the result of
 * `defineRelations`. Build it once at module scope. Views and non-table
 * exports are ignored; a table name that appears in two included schemas
 * throws, since a bare name could not tell them apart.
 */
export const functionPermissionTables = (
  schemaObject: Record<string, unknown>,
  { schemas = [DEFAULT_SCHEMA] }: FunctionPermissionTablesOptions = {}
): FunctionPermissionTables => {
  const tables = new Map<string, string>()

  for (const value of Object.values(schemaObject)) {
    const table = tableOf(value)
    if (!table) {
      continue
    }
    const { name, schema = DEFAULT_SCHEMA } = getTableConfig(table)
    if (!schemas.includes(schema)) {
      continue
    }
    const existing = tables.get(name)
    if (existing !== undefined && existing !== schema) {
      throw new Error(
        `Table "${name}" exists in both "${existing}" and "${schema}"; include only one of those schemas`
      )
    }
    tables.set(name, schema)
  }

  return tables
}

export type FunctionPermissions = Record<FunctionPolicyOperation, boolean>

/**
 * Anything with Drizzle's `execute` returning rows: a postgres-js client from
 * `@zeno-lib/db`, a `PgAsyncDatabase`, or a transaction.
 */
export type QueryExecutor = {
  execute: (query: SQL) => PromiseLike<readonly Record<string, unknown>[]>
}

export type SelectFunctionPermissionsOptions = {
  /** From `functionPermissionTables`. */
  tables: FunctionPermissionTables
  /** The table asked about, checked against `tables`. */
  table: string
  /**
   * The row, passed to every function but `insert` (there is no row yet) as
   * a named argument. Omit to call all four with none.
   */
  id?: number | string
  /** Name of the functions' row parameter. Default `"id"`. */
  argumentName?: string
  /** Function prefix, as given to `functionPolicies`. Default `"can"`. */
  prefix?: string
  /** Schema the functions live in. Default: the table's own. */
  functionSchema?: string
}

/**
 * The four `<prefix>_<operation>_<table>()` answers for one table, in one
 * statement: the read side of `functionPolicies`, for showing or hiding UI.
 *
 * `table` is only ever a map key: every identifier that reaches the statement
 * comes from `tables` and is quoted with `sql.identifier`. A function missing
 * or with another signature raises `42883` (`SqlState.undefinedFunction`).
 * A `null` answer, which a function gives for a row the caller cannot see,
 * counts as `false`, as does anything else that is not `true`.
 */
export const selectFunctionPermissions = async (
  db: QueryExecutor,
  {
    argumentName = "id",
    functionSchema,
    id,
    prefix = DEFAULT_FUNCTION_PREFIX,
    table,
    tables,
  }: SelectFunctionPermissionsOptions
): Promise<FunctionPermissions> => {
  const tableSchema = tables.get(table)

  if (tableSchema === undefined) {
    throw new Error(`No permission functions for table "${table}"`)
  }

  const schema = functionSchema ?? tableSchema

  const call = (operation: FunctionPolicyOperation) => {
    const callee = sql`${sql.identifier(schema)}.${sql.identifier(functionPolicyName(prefix, operation, table))}`
    return operation === "insert" || id === undefined
      ? sql`${callee}()`
      : sql`${callee}(${sql.identifier(argumentName)} => ${id})`
  }

  const row = one(
    await db.execute(
      sql`select ${sql.join(
        FUNCTION_POLICY_OPERATIONS.map(
          (operation) => sql`${call(operation)} as ${sql.identifier(operation)}`
        ),
        sql`, `
      )}`
    )
  )

  return {
    delete: row.delete === true,
    insert: row.insert === true,
    select: row.select === true,
    update: row.update === true,
  }
}
