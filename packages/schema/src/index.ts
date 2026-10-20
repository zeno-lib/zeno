/* biome-ignore-all lint/performance/noBarrelFile: package root intentionally re-exports the public schema surface. */
import {
  type Column,
  getColumns,
  type InferInsertModel,
  type InferSelectModel,
  type Table,
} from "drizzle-orm"
import {
  type BuildRefine,
  type BuildSchema,
  type CoerceOptions,
  type CreateSchemaFactoryOptions,
  createSchemaFactory as createDrizzleSchemaFactory,
  type NoUnknownKeys,
} from "drizzle-orm/zod"
import type { z } from "zod"

export {
  createInsertSchema,
  createSchemaFactory,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/zod"

declare const noTableSchemaOptions: unique symbol
type NoTableSchemaOptions = { [noTableSchemaOptions]?: never }

type TableColumns<TTable extends Table> = TTable["_"]["columns"]

// The keys `timestamps()` and `authorship()` from `@zeno-lib/db/schema` emit.
// This package cannot import them, so it matches the names instead, and only
// when the column has a default, since a column the database never fills is
// one the caller has to write.
const AUDIT_COLUMN_KEYS = new Set<string>([
  "createdAt",
  "createdBy",
  "updatedAt",
  "updatedBy",
])
type AuditColumnKey = "createdAt" | "createdBy" | "updatedAt" | "updatedBy"

// The key a table built by `table()` from `@zeno-lib/db/schema` carries its
// column rules under. A string rather than a symbol, so the two packages agree
// on it without either importing the other; `@zeno-lib/db` mirrors it and
// `packages/db/src/column-rules.test.ts` fails if they drift.
const COLUMN_RULES_KEY = "~zeno"

/**
 * What a column marker from `@zeno-lib/db/schema` records: `serverOwned`
 * keeps the column out of insert and update, `refine` runs on it in both.
 */
type ColumnRule = { readonly serverOwned: true } | { readonly refine: unknown }

type TableColumnRules<TTable> = TTable extends {
  readonly [COLUMN_RULES_KEY]: { readonly columns: infer TRules }
}
  ? TRules
  : Record<never, never>

type ServerOwnedKeys<TTable> = {
  [K in keyof TableColumnRules<TTable>]: TableColumnRules<TTable>[K] extends {
    readonly serverOwned: true
  }
    ? K
    : never
}[keyof TableColumnRules<TTable>]

type ColumnRefinements<TTable> = {
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

type AuditKeys<TTable extends Table> = {
  [K in keyof TableColumns<TTable>]: K extends AuditColumnKey
    ? TableColumns<TTable>[K]["_"]["hasDefault"] extends true
      ? K
      : never
    : never
}[keyof TableColumns<TTable>]

// The keys insert and update never accept: defaulted audit columns,
// server-owned columns and identities.
type UnwritableKeys<TTable extends Table> =
  | AuditKeys<TTable>
  | IdentityKeys<TTable>
  | ServerOwnedKeys<TTable>

type InsertColumns<TTable extends Table> = Pick<
  TableColumns<TTable>,
  Exclude<keyof InferInsertModel<TTable>, UnwritableKeys<TTable>>
>

type SelectRefine<
  TTable extends Table,
  TCoerce extends CoerceOptions,
> = BuildRefine<TableColumns<TTable>, TCoerce>
type InsertRefine<
  TTable extends Table,
  TCoerce extends CoerceOptions,
> = BuildRefine<InsertColumns<TTable>, TCoerce>
type UpdateRefine<
  TTable extends Table,
  TCoerce extends CoerceOptions,
> = BuildRefine<InsertColumns<TTable>, TCoerce>

type DefineTableSchemaOptions<
  TTable extends Table,
  TCoerce extends CoerceOptions = undefined,
> = {
  factory?: CreateSchemaFactoryOptions<TCoerce>
  insert?: NoUnknownKeys<
    InsertRefine<TTable, TCoerce>,
    InferInsertModel<TTable>
  >
  select?: NoUnknownKeys<
    SelectRefine<TTable, TCoerce>,
    InferSelectModel<TTable>
  >
  update?: UpdateRefine<TTable, TCoerce>
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
type WriteRefine<TTable extends Table, TOptions, TKey extends string> =
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
  TTable extends Table,
  TCoerce extends CoerceOptions,
  TOptions,
> = {
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
    UnwritableKeys<TTable>
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
    UnwritableKeys<TTable>
  >
}

type Refinements = Record<string, unknown>

const columnRules = (table: Table): Record<string, ColumnRule> =>
  (table as { [COLUMN_RULES_KEY]?: { columns: Record<string, ColumnRule> } })[
    COLUMN_RULES_KEY
  ]?.columns ?? {}

const unwritableKeys = (table: Table) => {
  const columns: Record<string, Column> = getColumns(table)
  const rules = columnRules(table)
  const keys: string[] = []

  for (const key of Object.keys(columns)) {
    const column = columns[key]
    const isAudit = AUDIT_COLUMN_KEYS.has(key) && column?.hasDefault
    const isIdentity = column?.generatedIdentity !== undefined
    const rule = rules[key]
    const isServerOwned = rule !== undefined && "serverOwned" in rule

    if (isAudit || isIdentity || isServerOwned) {
      keys.push(key)
    }
  }

  return keys
}

type SchemaRefinement = (schema: unknown) => unknown

const applyRefinement = (refinement: unknown, schema: unknown) =>
  typeof refinement === "function"
    ? (refinement as SchemaRefinement)(schema)
    : refinement

// A caller's function refinement runs on the column rule's schema, so it can
// narrow further; a caller's schema replaces it outright, as it replaces any
// generated rule.
const withColumnRules = (
  table: Table,
  refinements: Refinements = {}
): Refinements => {
  const merged: Refinements = { ...refinements }

  const rules = columnRules(table)

  for (const key of Object.keys(rules)) {
    const rule = rules[key]

    if (rule === undefined || !("refine" in rule)) {
      continue
    }

    const refinement = refinements[key]

    if (refinement === undefined) {
      merged[key] = rule.refine
    } else if (typeof refinement === "function") {
      merged[key] = (schema: unknown) =>
        (refinement as SchemaRefinement)(applyRefinement(rule.refine, schema))
    }
  }

  return merged
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

// A caller's function refinement runs on the positive schema, so it can narrow
// further. A caller's schema replaces the column schema outright, positive
// check included, the same as it replaces every other generated rule.
const withPositiveIdentities = (
  table: Table,
  refinements: Refinements = {}
): Refinements => {
  const columns: Record<string, Column> = getColumns(table)
  const merged: Refinements = { ...refinements }

  for (const key of Object.keys(columns)) {
    const column = columns[key]

    if (column === undefined || !isPositiveIdentity(column)) {
      continue
    }

    const refinement = refinements[key]

    if (refinement === undefined) {
      merged[key] = toPositive
    } else if (typeof refinement === "function") {
      merged[key] = (schema: unknown) => refinement(toPositive(schema))
    }
  }

  return merged
}

function defineTableSchema<TTable extends Table>(
  table: TTable
): DefineTableSchemaResult<TTable, undefined, NoTableSchemaOptions>
function defineTableSchema<
  TTable extends Table,
  TCoerce extends CoerceOptions = undefined,
  TOptions extends DefineTableSchemaOptions<
    TTable,
    TCoerce
  > = DefineTableSchemaOptions<TTable, TCoerce>,
>(
  table: TTable,
  options: TOptions
): DefineTableSchemaResult<TTable, TCoerce, TOptions>
function defineTableSchema<
  TTable extends Table,
  TCoerce extends CoerceOptions = undefined,
  TOptions extends DefineTableSchemaOptions<
    TTable,
    TCoerce
  > = DefineTableSchemaOptions<TTable, TCoerce>,
>(
  table: TTable,
  options?: TOptions
): DefineTableSchemaResult<TTable, TCoerce, TOptions> {
  const schemaFactory = createDrizzleSchemaFactory(options?.factory)
  const unwritable = unwritableKeys(table)
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
  ) => omitUnwritable(create(table, withColumnRules(table, options?.[variant])))

  return {
    insert: write("insert", factory.createInsertSchema),
    select: factory.createSelectSchema(
      table,
      withPositiveIdentities(table, options?.select)
    ),
    update: write("update", factory.createUpdateSchema),
  } as unknown as DefineTableSchemaResult<TTable, TCoerce, TOptions>
}

export type { DefineTableSchemaOptions, DefineTableSchemaResult }
export { defineTableSchema }
