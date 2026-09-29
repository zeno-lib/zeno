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

type AuditKeys<TTable extends Table> = {
  [K in keyof TableColumns<TTable>]: K extends AuditColumnKey
    ? TableColumns<TTable>[K]["_"]["hasDefault"] extends true
      ? K
      : never
    : never
}[keyof TableColumns<TTable>]

type InsertColumns<TTable extends Table> = Pick<
  TableColumns<TTable>,
  Exclude<keyof InferInsertModel<TTable>, AuditKeys<TTable>>
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
        RefineFromOptions<TOptions, "insert">,
        TCoerce
      >,
      TTable,
      RefineFromOptions<TOptions, "insert">
    >,
    AuditKeys<TTable>
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
      RefineFromOptions<TOptions, "update">,
      TCoerce
    >,
    AuditKeys<TTable>
  >
}

type Refinements = Record<string, unknown>

const auditKeys = (table: Table) => {
  const columns: Record<string, Column> = getColumns(table)
  const keys: string[] = []

  for (const key of Object.keys(columns)) {
    if (AUDIT_COLUMN_KEYS.has(key) && columns[key]?.hasDefault) {
      keys.push(key)
    }
  }

  return keys
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
  const audit = auditKeys(table)
  // Zod rejects an omit key the shape lacks, which a generated audit column
  // would be.
  const omitAudit = (schema: z.ZodObject) => {
    const mask: Record<string, true> = {}

    for (const key of audit) {
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
  const build = (
    variant: "insert" | "select" | "update",
    create: (typeof factory)["createInsertSchema"]
  ) => create(table, withPositiveIdentities(table, options?.[variant]))

  return {
    insert: omitAudit(build("insert", factory.createInsertSchema)),
    select: build("select", factory.createSelectSchema),
    update: omitAudit(build("update", factory.createUpdateSchema)),
  } as unknown as DefineTableSchemaResult<TTable, TCoerce, TOptions>
}

export type { DefineTableSchemaOptions, DefineTableSchemaResult }
export { defineTableSchema }
