// Query-side helpers: the PostgREST conveniences Drizzle has no equivalent for
// (`.single()`, `.maybeSingle()`, a default upsert `set`), syncing a parent's
// rows, plus the read side of `functionPolicies`.
import {
  type AnyRelations,
  and,
  eq,
  getColumns,
  getTableName,
  type InferInsertModel,
  type InferSelectModel,
  inArray,
  is,
  isNull,
  or,
  type SQL,
  sql,
} from "drizzle-orm"
import {
  getTableConfig,
  type PgAsyncDatabase,
  type PgColumn,
  type PgQueryResultHKT,
  PgTable,
} from "drizzle-orm/pg-core"
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

type InsertModel<TTable extends PgTable> = InferInsertModel<TTable>
type SelectModel<TTable extends PgTable> = InferSelectModel<TTable>

type SyncRowsBaseOptions<
  TQueryResult extends PgQueryResultHKT,
  TRelations extends AnyRelations,
  TTable extends PgTable,
  TParent,
> = {
  /**
   * The columns that make a row the parent's, with their values, such as
   * `{ orderId }`. Only rows matching all of them are read, updated or
   * removed, and every row is written with them. At least one isn't `null`.
   */
  parent: TParent
  /**
   * Removes the stored rows that left the list, instead of deleting them: to
   * unlink, soft-delete, or delete only what nothing else references. Called
   * once, before any update or insert, and only when there is a row to remove.
   */
  remove?: (
    tx: PgAsyncDatabase<TQueryResult, TRelations>,
    rows: SelectModel<TTable>[]
  ) => Promise<unknown>
}

export type SyncRowsByIdOptions<
  TQueryResult extends PgQueryResultHKT,
  TRelations extends AnyRelations,
  TTable extends PgTable,
  TParent,
  TId extends ColumnKey<TTable>,
> = SyncRowsBaseOptions<TQueryResult, TRelations, TTable, TParent> & {
  /** The surrogate key column. Default `"id"`. */
  id?: TId
  key?: undefined
  /**
   * The parent's rows, in the order to return them. A row without an id is
   * new.
   */
  rows: readonly (Omit<InsertModel<TTable>, keyof TParent | NoInfer<TId>> & {
    [K in NoInfer<TId>]?:
      | (K extends keyof SelectModel<TTable> ? SelectModel<TTable>[K] : never)
      | null
  })[]
}

export type SyncRowsByKeyOptions<
  TQueryResult extends PgQueryResultHKT,
  TRelations extends AnyRelations,
  TTable extends PgTable,
  TParent,
  TKey extends ColumnKey<TTable>,
> = SyncRowsBaseOptions<TQueryResult, TRelations, TTable, TParent> & {
  id?: undefined
  /**
   * The natural key columns that tell the parent's rows apart, such as
   * `["productId"]`. Each row must carry them; a `null` matches a `null`.
   */
  key: readonly TKey[]
  /** The parent's rows, in the order to return them. */
  rows: readonly (Omit<InsertModel<TTable>, keyof TParent> &
    Required<
      Pick<
        InsertModel<TTable>,
        Extract<
          Exclude<NoInfer<TKey>, keyof TParent>,
          keyof InsertModel<TTable>
        >
      >
    >)[]
}

type Row = Record<string, unknown>

// A key value as JSON, for a `Map` key: a Date becomes its instant, since two
// Dates are never `===`, and a bigint its digits, since JSON can't hold one.
const keyPart = (value: unknown): unknown => {
  if (value instanceof Date) {
    return value.toISOString()
  }
  if (typeof value === "bigint") {
    return value.toString()
  }
  return value ?? null
}

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(keyPart(a)) === JSON.stringify(keyPart(b))

/**
 * Makes `rows` the parent's whole set of rows in `table`: the stored rows that
 * left the list are removed first, so a removed key can come straight back,
 * then each row updates the stored row it matches or is inserted. Resolves to
 * the resulting rows in input order, so a form can take up the new ids.
 *
 * Rows are told apart by one of:
 *
 * - `id` (the default, on `"id"`): a surrogate key. A row without one is
 *   inserted. An id the parent doesn't hold (another parent's row, or one
 *   deleted since the form loaded it) is dropped and the row inserted anew, so
 *   a sync never writes another parent's row. On a column without a default,
 *   the id is kept and a taken one fails on the primary key.
 * - `key`: natural key columns, compared as the driver returns them. A key
 *   another parent holds fails on the table's unique index rather than moving
 *   that row over.
 *
 * An update sets only the columns the row carries and changes, skipping
 * `undefined`, and a stored row with nothing to change is returned as it is,
 * unwritten. An empty list removes every row the parent has. Two rows with the
 * same key throw before anything is written.
 *
 * Everything runs in `db.transaction`: its own transaction on a client, a
 * savepoint inside a `tx`. A failure undoes every write the sync made and
 * nothing else, so a caller that catches it keeps a usable transaction.
 *
 * ```ts
 * const lines = await syncRows(tx, orderLines, {
 *   parent: { orderId: order.id },
 *   rows: input.lines,
 * })
 *
 * await syncRows(tx, postsTags, {
 *   key: ["tagId"],
 *   parent: { postId: post.id },
 *   rows: input.tagIds.map((tagId) => ({ tagId })),
 * })
 * ```
 */
export const syncRows = <
  TQueryResult extends PgQueryResultHKT,
  TRelations extends AnyRelations,
  TTable extends PgTable,
  TParent extends Partial<InsertModel<TTable>>,
  TId extends ColumnKey<TTable> = Extract<"id", ColumnKey<TTable>>,
  TKey extends ColumnKey<TTable> = never,
>(
  db: PgAsyncDatabase<TQueryResult, TRelations>,
  table: TTable,
  options:
    | SyncRowsByIdOptions<TQueryResult, TRelations, TTable, TParent, TId>
    | SyncRowsByKeyOptions<TQueryResult, TRelations, TTable, TParent, TKey>
): Promise<SelectModel<TTable>[]> =>
  sync(db as AnyDatabase, table, options as SyncOptions) as Promise<
    SelectModel<TTable>[]
  >

type AnyDatabase = PgAsyncDatabase<PgQueryResultHKT, AnyRelations>

type SyncOptions = {
  id?: string
  key?: readonly string[]
  parent: Row
  remove?: (tx: AnyDatabase, rows: Row[]) => Promise<unknown>
  rows: readonly Row[]
}

// Async, so a bad argument rejects like a failed statement instead of throwing.
const sync = async (
  db: AnyDatabase,
  table: PgTable,
  { id = "id", key, parent, remove, rows }: SyncOptions
): Promise<Row[]> => {
  // A Map, so an inherited name such as `constructor` is never a column.
  const columns = new Map<string, PgColumn>(Object.entries(getColumns(table)))
  const column = (name: string) => {
    const found = columns.get(name)
    if (!found) {
      throw new Error(
        `"${name}" is not a column of table "${getTableName(table)}"`
      )
    }
    return found
  }
  // `null` matches `null`, which `=` never does.
  const matching = (row: Row, names: readonly string[]) =>
    and(
      ...names.map((name) =>
        row[name] === null ? isNull(column(name)) : eq(column(name), row[name])
      )
    )

  const parentNames = Object.keys(parent)
  // A missing parent column would widen the sync to other parents' rows, and
  // so would a parent of nulls alone, which matches every orphaned row.
  if (
    parentNames.length === 0 ||
    parentNames.some((name) => parent[name] === undefined)
  ) {
    throw new Error("syncRows needs a value for every parent column")
  }
  if (parentNames.every((name) => parent[name] === null)) {
    throw new Error("syncRows needs a parent column that isn't null")
  }
  const scope = matching(parent, parentNames)
  const keyNames = key ?? [id]
  for (const name of keyNames) {
    column(name)
  }

  // A row without an id is new.
  const identity = (row: Row) =>
    key === undefined && (row[id] === undefined || row[id] === null)
      ? undefined
      : JSON.stringify(keyNames.map((name) => keyPart(row[name])))

  const wanted = rows.map((row) => ({ ...row, ...parent }))
  const listed = new Map<string, number>()
  for (const [index, row] of wanted.entries()) {
    // The insert would store the column default instead, so the saved row
    // would never match its own key again.
    const missing = key?.find((name) => row[name] === undefined)
    if (missing !== undefined) {
      throw new Error(`Row ${index} has no value for key column "${missing}"`)
    }
    const rowKey = identity(row)
    if (rowKey === undefined) {
      continue
    }
    const first = listed.get(rowKey)
    if (first !== undefined) {
      throw new Error(`Rows ${first} and ${index} have the same key`)
    }
    listed.set(rowKey, index)
  }

  return await db.transaction(async (tx) => {
    const stored: Row[] = await tx.select().from(table).where(scope)
    const byKey = new Map(stored.map((row) => [identity(row), row]))
    const removed = stored.filter((row) => !listed.has(identity(row) ?? ""))

    if (removed.length > 0) {
      // One `IN` list for a single key column, which can't match a null.
      const only = keyNames.length === 1 ? keyNames[0] : undefined
      const values = only === undefined ? [] : removed.map((row) => row[only])
      await (remove
        ? remove(tx, removed)
        : tx
            .delete(table)
            .where(
              and(
                scope,
                only !== undefined && !values.includes(null)
                  ? inArray(column(only), values)
                  : or(...removed.map((row) => matching(row, keyNames)))
              )
            ))
    }

    const save = async (row: Row): Promise<Row> => {
      const rowKey = identity(row)
      const match = rowKey === undefined ? undefined : byKey.get(rowKey)

      if (!match) {
        // An id the parent doesn't hold is dropped, so the row is new, unless
        // the column has no default to fill in: then the caller assigns ids,
        // and a taken one fails on the primary key rather than moving a row.
        const values =
          key === undefined && column(id).hasDefault
            ? { ...row, [id]: undefined }
            : row
        const inserted = await tx.insert(table).values(values).returning()
        return one(inserted as Row[])
      }

      // An unchanged column isn't set, so an untouched row isn't written and
      // its `updated_at` trigger doesn't fire.
      const set = Object.fromEntries(
        Object.entries(definedValues(row)).filter(
          ([name, value]) =>
            columns.has(name) &&
            !keyNames.includes(name) &&
            !parentNames.includes(name) &&
            !sameValue(value, match[name])
        )
      )
      if (Object.keys(set).length === 0) {
        return match
      }
      return one(
        await tx
          .update(table)
          .set(set)
          .where(and(scope, matching(match, keyNames)))
          .returning()
      )
    }

    const saved: Row[] = []
    for (const row of wanted) {
      // biome-ignore lint/performance/noAwaitInLoops: a transaction is one connection, so its writes run one at a time, and in input order
      saved.push(await save(row))
    }
    return saved
  })
}

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
  if (typeof value !== "object" || value === null || !("table" in value)) {
    return
  }
  const { table } = value
  return is(table, PgTable) ? table : undefined
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
