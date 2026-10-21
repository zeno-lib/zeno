/* biome-ignore-all lint/performance/noBarrelFile: package root intentionally re-exports the public schema surface. */
import {
  type Column,
  getColumns,
  getTableName,
  getTableUniqueName,
  type InferInsertModel,
  type InferSelectModel,
  is,
  Table,
} from "drizzle-orm"
import {
  type BuildRefine,
  type BuildSchema,
  type CoerceOptions,
  type CreateSchemaFactoryOptions,
  createSchemaFactory as createDrizzleSchemaFactory,
  type NoUnknownKeys,
} from "drizzle-orm/zod"
import { z } from "zod"

export {
  createInsertSchema,
  createSchemaFactory,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/zod"

declare const noTableSchemaOptions: unique symbol
type NoTableSchemaOptions = { [noTableSchemaOptions]?: never }

type TableColumns<TTable extends Table> = TTable["_"]["columns"]

// The key a table built by `table()` from `@zeno-lib/db/schema` carries its
// column rules under. A string rather than a symbol, so the two packages agree
// on it without either importing the other; `@zeno-lib/db` mirrors it and
// `packages/db/src/column-rules.test.ts` fails if they drift.
const COLUMN_RULES_KEY = "~zeno"

/**
 * What a column marker from `@zeno-lib/db/schema` records. `writer` says who
 * writes the column when a client doesn't: `"server"` code (`serverOwned`), or
 * only the `"database"`, through a default and a trigger (the audit columns
 * `timestamps()` and `authorship()` emit). `refine` runs on it in insert and
 * update.
 */
type ColumnRule = {
  readonly writer?: "database" | "server"
  readonly refine?: unknown
}

type Writer = NonNullable<ColumnRule["writer"]>

/**
 * A table built by `table()`, `unsecureTable()` or `schema(...).table` from
 * `@zeno-lib/db/schema`, which records its column rules. A plain drizzle
 * table has none, so its markers would vanish without a trace.
 */
type ZenoTable = Table & {
  readonly [COLUMN_RULES_KEY]: { readonly columns: object }
}

type TableColumnRules<TTable extends ZenoTable> =
  TTable[typeof COLUMN_RULES_KEY]["columns"]

type WrittenByKeys<TTable extends ZenoTable, TWriter extends Writer> = {
  [K in keyof TableColumnRules<TTable>]: TableColumnRules<TTable>[K] extends {
    readonly writer: TWriter
  }
    ? K
    : never
}[keyof TableColumnRules<TTable>]

type ColumnRefinements<TTable extends ZenoTable> = {
  [K in keyof TableColumnRules<TTable> as TableColumnRules<TTable>[K] extends {
    readonly refine: unknown
  }
    ? K
    : never]: TableColumnRules<TTable>[K] extends {
    readonly refine: infer TRefine
  }
    ? TRefine
    : never
}

// Identity columns, `by default` as well as `always`: the sequence hands them
// out, so a client never writes one. Drizzle drops only `always` itself.
type IdentityKeys<TTable extends Table> = {
  [K in keyof TableColumns<TTable>]: TableColumns<TTable>[K]["_"]["identity"] extends
    | "always"
    | "byDefault"
    ? K
    : never
}[keyof TableColumns<TTable>]

// Whose columns a variant leaves out: a client writes neither the database's
// nor the server's, and server code writes the server's.
type ClientExcludes = Writer
type ServerExcludes = "database"

// The keys insert and update never accept: identities, and the columns
// `TExcludes` writes.
type UnwritableKeys<
  TTable extends ZenoTable,
  TExcludes extends Writer = ClientExcludes,
> = IdentityKeys<TTable> | WrittenByKeys<TTable, TExcludes>

type InsertColumns<
  TTable extends ZenoTable,
  TExcludes extends Writer = ClientExcludes,
> = Pick<
  TableColumns<TTable>,
  Exclude<keyof InferInsertModel<TTable>, UnwritableKeys<TTable, TExcludes>>
>

type SelectRefine<
  TTable extends Table,
  TCoerce extends CoerceOptions,
> = BuildRefine<TableColumns<TTable>, TCoerce>
type WriteRefineOptions<
  TTable extends ZenoTable,
  TCoerce extends CoerceOptions,
  TExcludes extends Writer,
> = BuildRefine<InsertColumns<TTable, TExcludes>, TCoerce>

type DefineTableSchemaOptions<
  TTable extends ZenoTable,
  TCoerce extends CoerceOptions = undefined,
  TExcludes extends Writer = ClientExcludes,
> = {
  factory?: CreateSchemaFactoryOptions<TCoerce>
  insert?: NoUnknownKeys<
    WriteRefineOptions<TTable, TCoerce, TExcludes>,
    InferInsertModel<TTable>
  >
  select?: NoUnknownKeys<
    SelectRefine<TTable, TCoerce>,
    InferSelectModel<TTable>
  >
  update?: WriteRefineOptions<TTable, TCoerce, TExcludes>
}

type RefineFromOptions<
  TOptions,
  TKey extends string,
> = TKey extends keyof TOptions
  ? NonNullable<TOptions[TKey]> extends Record<string, unknown>
    ? NonNullable<TOptions[TKey]>
    : undefined
  : undefined

// A caller's refinement for a key replaces the column rule's in the type: a
// function receives the column rule's schema at runtime and returns its own.
type WriteRefine<TTable extends ZenoTable, TOptions, TKey extends string> =
  RefineFromOptions<TOptions, TKey> extends infer TCaller
    ? TCaller extends Record<string, unknown>
      ? Omit<ColumnRefinements<TTable>, keyof TCaller> & TCaller
      : ColumnRefinements<TTable>
    : never

type OmitKeys<TSchema, TKeys extends PropertyKey> =
  TSchema extends z.ZodObject<infer TShape, infer TConfig>
    ? z.ZodObject<
        { [K in keyof TShape as K extends TKeys ? never : K]: TShape[K] },
        TConfig
      >
    : never

// Drizzle types a function refinement on an insert column as required, even
// when the column is nullable or defaulted and the runtime wraps it in
// `.optional()`. This puts the wrapper back into the type.
type IsInsertOptional<TColumn> = TColumn extends Column
  ? TColumn["_"]["notNull"] extends true
    ? TColumn["_"]["hasDefault"] extends true
      ? true
      : false
    : true
  : false

type OptionalRefinedInsert<TSchema, TTable extends Table, TRefine> =
  TSchema extends z.ZodObject<infer TShape, infer TConfig>
    ? z.ZodObject<
        {
          [K in keyof TShape]: K extends keyof TRefine
            ? TRefine[K] extends (schema: never) => unknown
              ? (
                  K extends keyof TableColumns<TTable>
                    ? IsInsertOptional<TableColumns<TTable>[K]>
                    : false
                ) extends true
                ? TShape[K] extends z.ZodOptional
                  ? TShape[K]
                  : z.ZodOptional<TShape[K]>
                : TShape[K]
              : TShape[K]
            : TShape[K]
        },
        TConfig
      >
    : never

type DefineTableSchemaResult<
  TTable extends ZenoTable,
  TCoerce extends CoerceOptions,
  TOptions,
  TExcludes extends Writer = ClientExcludes,
> = {
  /** The table the schemas come from, for `ownedRows`. */
  table: TTable
  insert: OmitKeys<
    OptionalRefinedInsert<
      BuildSchema<
        "insert",
        TableColumns<TTable>,
        WriteRefine<TTable, TOptions, "insert">,
        TCoerce
      >,
      TTable,
      WriteRefine<TTable, TOptions, "insert">
    >,
    UnwritableKeys<TTable, TExcludes>
  >
  select: BuildSchema<
    "select",
    TableColumns<TTable>,
    RefineFromOptions<TOptions, "select">,
    TCoerce
  >
  update: OmitKeys<
    BuildSchema<
      "update",
      TableColumns<TTable>,
      WriteRefine<TTable, TOptions, "update">,
      TCoerce
    >,
    UnwritableKeys<TTable, TExcludes>
  >
}

type Refinements = Record<string, unknown>

const columnRules = (table: ZenoTable) =>
  table[COLUMN_RULES_KEY].columns as Record<string, ColumnRule>

const CLIENT_EXCLUDES: ReadonlySet<Writer> = new Set(["database", "server"])
const SERVER_EXCLUDES: ReadonlySet<Writer> = new Set(["database"])

const unwritableKeys = (table: ZenoTable, excludes: ReadonlySet<Writer>) => {
  const columns: Record<string, Column> = getColumns(table)
  const rules = columnRules(table)
  const keys: string[] = []

  for (const key of Object.keys(columns)) {
    const isIdentity = columns[key]?.generatedIdentity !== undefined
    const writer = rules[key]?.writer

    if (isIdentity || (writer !== undefined && excludes.has(writer))) {
      keys.push(key)
    }
  }

  return keys
}

type SchemaRefinement = (schema: unknown) => unknown

// `generated` under the caller's `refinements`: a caller's function runs on
// the generated schema, so it can narrow further; a caller's schema replaces
// it outright, as it replaces any rule drizzle generates.
const composeRefinements = (
  refinements: Refinements | undefined,
  generated: Record<string, SchemaRefinement>
): Refinements => {
  const merged: Refinements = { ...refinements }

  for (const key of Object.keys(generated)) {
    const inner = generated[key] as SchemaRefinement
    const refinement = refinements?.[key]

    if (refinement === undefined) {
      merged[key] = inner
    } else if (typeof refinement === "function") {
      merged[key] = (schema: unknown) =>
        (refinement as SchemaRefinement)(inner(schema))
    }
  }

  return merged
}

const withRuleRefinements = (table: ZenoTable, refinements?: Refinements) => {
  const rules = columnRules(table)
  const generated: Record<string, SchemaRefinement> = {}

  for (const key of Object.keys(rules)) {
    const rule = rules[key]?.refine

    if (typeof rule === "function") {
      generated[key] = rule as SchemaRefinement
    }
  }

  return composeRefinements(refinements, generated)
}

// Postgres starts an ascending identity at its minimum value, which defaults
// to 1, so only a sequence configured below that can hand out 0 or less.
const isPositiveIdentity = (column: Column) => {
  const identity = column.generatedIdentity

  if (identity === undefined) {
    return false
  }

  const {
    increment = 1,
    minValue = 1,
    startWith = minValue,
  } = identity.sequenceOptions ?? {}

  return Number(increment) > 0 && Number(minValue) > 0 && Number(startWith) > 0
}

type PositiveSchema = { positive: () => unknown }

const toPositive = (schema: unknown) =>
  typeof (schema as Partial<PositiveSchema>).positive === "function"
    ? (schema as PositiveSchema).positive()
    : schema

const positiveCheck = (column: Column) =>
  isPositiveIdentity(column) ? toPositive : undefined

// Drizzle's string mode reads Postgres's text form back
// (`2026-09-17 07:53:56.357127+00`), which ISO 8601 doesn't cover, so a
// timestamp takes a `T` or a space, and an offset of hours with optional
// minutes. One with a time zone needs the offset, which would otherwise come
// from the session's time zone.
const TIMESTAMP_TZ =
  /^\d{4}-[01]\d-[0-3]\d[T ][0-2]\d:[0-5]\d(:[0-5]\d(\.\d+)?)?([+-][0-2]\d(:?[0-5]\d)?|Z)$/
const TIMESTAMP =
  /^\d{4}-[01]\d-[0-3]\d[T ][0-2]\d:[0-5]\d(:[0-5]\d(\.\d+)?)?([+-][0-2]\d(:?[0-5]\d)?|Z)?$/

const toTimestamp = (pattern: RegExp) => (schema: unknown) =>
  (schema as z.ZodString).check((context) => {
    if (!pattern.test(context.value)) {
      // Zod's own code and format, so its locale words the message.
      context.issues.push({
        code: "invalid_format",
        format: "datetime",
        input: context.value,
      })
    }
  })

const toDate = (schema: unknown) => (schema as z.ZodString).check(z.iso.date())

// A string-mode `date` or `timestamp` column holds text Postgres must parse,
// and Drizzle's bridge only asks for a string.
const formatCheck = (column: Column): SchemaRefinement | undefined => {
  switch (column.dataType) {
    case "string date":
      return toDate
    case "string timestamp":
      return toTimestamp(
        (column as Column & { withTimezone?: boolean }).withTimezone
          ? TIMESTAMP_TZ
          : TIMESTAMP
      )
    default:
      return undefined
  }
}

// Each column's check, under the caller's refinement for it.
const withChecks = (
  table: Table,
  checkFor: (column: Column) => SchemaRefinement | undefined,
  refinements: Refinements | undefined
) => {
  const columns: Record<string, Column> = getColumns(table)
  const generated: Record<string, SchemaRefinement> = {}

  for (const key of Object.keys(columns)) {
    const column = columns[key]
    const check = column === undefined ? undefined : checkFor(column)

    if (check !== undefined) {
      generated[key] = check
    }
  }

  return composeRefinements(refinements, generated)
}

const buildTableSchema = (
  name: string,
  table: ZenoTable,
  options: DefineTableSchemaOptions<ZenoTable, CoerceOptions> | undefined,
  excludes: ReadonlySet<Writer>
) => {
  // The type already refuses a plain drizzle table. This catches a cast, or a
  // caller without TypeScript, before its markers are silently ignored.
  if (!(COLUMN_RULES_KEY in table)) {
    throw new TypeError(
      `${name} reads the column rules of a table from table(), unsecureTable() or schema(...).table in @zeno-lib/db/schema, and "${getTableName(table)}" has none.`
    )
  }

  const schemaFactory = createDrizzleSchemaFactory(options?.factory)
  const unwritable = unwritableKeys(table, excludes)
  // Zod rejects an omit key the shape lacks, which a generated column would be.
  const omitUnwritable = (schema: z.ZodObject) => {
    const mask: Record<string, true> = {}

    for (const key of unwritable) {
      if (key in schema.shape) {
        mask[key] = true
      }
    }

    return schema.omit(mask)
  }
  // The drizzle factory's refinement parameters are typed per table, which a
  // generic `TTable` cannot satisfy, so the merged maps go in untyped.
  const factory = schemaFactory as unknown as Record<
    "createInsertSchema" | "createSelectSchema" | "createUpdateSchema",
    (table: Table, refine: Refinements) => z.ZodObject
  >
  // Column rules say what a client may write, so they reach insert and update.
  // `select` describes the stored row, which a rule the database doesn't
  // enforce may not hold for.
  const write = (
    variant: "insert" | "update",
    create: (typeof factory)["createInsertSchema"]
  ) =>
    omitUnwritable(
      create(
        table,
        withChecks(
          table,
          formatCheck,
          withRuleRefinements(table, options?.[variant] as Refinements)
        )
      )
    )

  return {
    insert: write("insert", factory.createInsertSchema),
    select: factory.createSelectSchema(
      table,
      withChecks(table, positiveCheck, options?.select as Refinements)
    ),
    table,
    update: write("update", factory.createUpdateSchema),
  }
}

function defineTableSchema<TTable extends ZenoTable>(
  table: TTable
): DefineTableSchemaResult<TTable, undefined, NoTableSchemaOptions>
function defineTableSchema<
  TTable extends ZenoTable,
  TCoerce extends CoerceOptions = undefined,
  TOptions extends DefineTableSchemaOptions<
    TTable,
    TCoerce
  > = DefineTableSchemaOptions<TTable, TCoerce>,
>(
  table: TTable,
  options: TOptions
): DefineTableSchemaResult<TTable, TCoerce, TOptions>
function defineTableSchema(
  table: ZenoTable,
  options?: DefineTableSchemaOptions<ZenoTable, CoerceOptions>
) {
  return buildTableSchema("defineTableSchema", table, options, CLIENT_EXCLUDES)
}

/**
 * `defineTableSchema` for code that runs only on the server, such as a sync
 * job, which writes the columns `serverOwned()` keeps from clients. Identity
 * and audit columns stay out, as the database writes them. Never parse what a
 * client sends with it: a server action's input is a client's.
 */
function defineServerTableSchema<TTable extends ZenoTable>(
  table: TTable
): DefineTableSchemaResult<
  TTable,
  undefined,
  NoTableSchemaOptions,
  ServerExcludes
>
function defineServerTableSchema<
  TTable extends ZenoTable,
  TCoerce extends CoerceOptions = undefined,
  TOptions extends DefineTableSchemaOptions<
    TTable,
    TCoerce,
    ServerExcludes
  > = DefineTableSchemaOptions<TTable, TCoerce, ServerExcludes>,
>(
  table: TTable,
  options: TOptions
): DefineTableSchemaResult<TTable, TCoerce, TOptions, ServerExcludes>
function defineServerTableSchema(
  table: ZenoTable,
  options?: DefineTableSchemaOptions<ZenoTable, CoerceOptions, ServerExcludes>
) {
  return buildTableSchema(
    "defineServerTableSchema",
    table,
    options as DefineTableSchemaOptions<ZenoTable, CoerceOptions>,
    SERVER_EXCLUDES
  )
}

type ColumnKey<TTable extends Table> = Extract<
  keyof TableColumns<TTable>,
  string
>

// The part of a `defineTableSchema` result `ownedRows` reads.
type OwnableSchema = {
  insert: z.ZodObject
  select: { shape: { id: z.ZodType } }
  table: ZenoTable
}

type OwnedRowSchema<TSchema extends OwnableSchema, TParentKey extends string> =
  TSchema["insert"] extends z.ZodObject<infer TShape, infer TConfig>
    ? z.ZodObject<
        {
          [K in keyof TShape as K extends TParentKey ? never : K]: TShape[K]
        } & { id: z.ZodOptional<TSchema["select"]["shape"]["id"]> },
        TConfig
      >
    : never

/**
 * A table's rows that belong to one parent row and are edited as a list, such
 * as an order's lines. `syncRows` from `@zeno-lib/db/query` takes it in place
 * of the table, and a form validates each row with `row`.
 */
type OwnedRows<
  TTable extends ZenoTable,
  TParentKey extends string,
  TRow extends z.ZodObject,
> = {
  /** The columns that point at the parent row, which `row` leaves out. */
  readonly parent: readonly TParentKey[]
  /**
   * One row as a client sends it: the `insert` columns but the parent's, and
   * the `id` of a stored row, absent on a new one.
   */
  readonly row: TRow
  readonly table: TTable
}

/**
 * The rows of `schema`'s table that belong to a parent through the `parent`
 * columns, for a form that edits them as a list and the `syncRows` that saves
 * it:
 *
 * ```ts
 * const orderLines = ownedRows(defineTableSchema(lines), { parent: "orderId" })
 *
 * const orderSchema = defineTableSchema(orders).insert.extend({
 *   lines: z.array(orderLines.row),
 * })
 *
 * await syncRows(tx, orderLines, { parent: { orderId }, rows: input.lines })
 * ```
 *
 * The table needs a sequential `id`. A link table matched by a natural key
 * goes to `syncRows` with its `key` option instead.
 */
const ownedRows = <
  TSchema extends OwnableSchema,
  TParentKey extends ColumnKey<TSchema["table"]>,
>(
  schema: TSchema,
  { parent }: { parent: TParentKey | readonly TParentKey[] }
): OwnedRows<
  TSchema["table"],
  TParentKey,
  OwnedRowSchema<TSchema, TParentKey>
> => {
  const parentKeys: readonly TParentKey[] =
    typeof parent === "string" ? [parent] : [...parent]
  const id = schema.select.shape.id as z.ZodType | undefined

  if (id === undefined) {
    throw new TypeError(
      `ownedRows tells rows apart by their id, and "${getTableName(schema.table)}" has none.`
    )
  }

  // Zod rejects an omit key the shape lacks, as a server-owned parent would be.
  const omitted: Record<string, true> = {}

  for (const key of parentKeys) {
    if (key in schema.insert.shape) {
      omitted[key] = true
    }
  }

  return {
    parent: parentKeys,
    row: schema.insert.omit(omitted).extend({ id: id.optional() }),
    table: schema.table,
  } as unknown as OwnedRows<
    TSchema["table"],
    TParentKey,
    OwnedRowSchema<TSchema, TParentKey>
  >
}

const isZenoTable = (value: unknown): value is ZenoTable =>
  is(value, Table) && COLUMN_RULES_KEY in value

/**
 * The columns a client may write, for every Zeno table among `exports` (a
 * schema barrel, say), keyed by name (`schema.table` outside `public`): what `defineTableSchema`'s
 * `insert` accepts, and `update` accepts the same. Columns are writable unless
 * marked, so snapshot this in one test, and a newly writable column shows up
 * as a diff in review.
 */
const writableColumns = (exports: Record<string, unknown>) => {
  const tables = Object.keys(exports)
    .map((key) => exports[key])
    .filter(isZenoTable)
    .map((table) => [getTableUniqueName(table), table] as const)
    // A plain sort, so the order doesn't hang on the machine's locale.
    .sort(([a], [b]) => (a < b ? -1 : 1))
  const columns: Record<string, string[]> = {}

  for (const [name, table] of tables) {
    columns[name] = Object.keys(
      buildTableSchema("writableColumns", table, undefined, CLIENT_EXCLUDES)
        .insert.shape
    ).sort()
  }

  return columns
}

export type {
  DefineTableSchemaOptions,
  DefineTableSchemaResult,
  OwnedRows,
  ZenoTable,
}
export {
  defineServerTableSchema,
  defineTableSchema,
  ownedRows,
  writableColumns,
}
