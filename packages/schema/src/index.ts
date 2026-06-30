/* biome-ignore-all lint/performance/noBarrelFile: package root intentionally re-exports the public schema surface. */
import type { InferInsertModel, InferSelectModel, Table } from "drizzle-orm"
import {
  type BuildRefine,
  type BuildSchema,
  type CoerceOptions,
  type CreateSchemaFactoryOptions,
  createSchemaFactory as createDrizzleSchemaFactory,
  type NoUnknownKeys,
} from "drizzle-orm/zod"

export {
  createInsertSchema,
  createSchemaFactory,
  createSelectSchema,
  createUpdateSchema,
} from "drizzle-orm/zod"

declare const noTableSchemaOptions: unique symbol
type NoTableSchemaOptions = { [noTableSchemaOptions]?: never }

type TableColumns<TTable extends Table> = TTable["_"]["columns"]
type InsertColumns<TTable extends Table> = Pick<
  TableColumns<TTable>,
  keyof InferInsertModel<TTable>
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

type DefineTableSchemaResult<
  TTable extends Table,
  TCoerce extends CoerceOptions,
  TOptions,
> = {
  insert: BuildSchema<
    "insert",
    TableColumns<TTable>,
    RefineFromOptions<TOptions, "insert">,
    TCoerce
  >
  select: BuildSchema<
    "select",
    TableColumns<TTable>,
    RefineFromOptions<TOptions, "select">,
    TCoerce
  >
  update: BuildSchema<
    "update",
    TableColumns<TTable>,
    RefineFromOptions<TOptions, "update">,
    TCoerce
  >
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

  return {
    insert: schemaFactory.createInsertSchema(
      table,
      options?.insert
    ) as DefineTableSchemaResult<TTable, TCoerce, TOptions>["insert"],
    select: schemaFactory.createSelectSchema(
      table,
      options?.select
    ) as DefineTableSchemaResult<TTable, TCoerce, TOptions>["select"],
    update: schemaFactory.createUpdateSchema(
      table,
      options?.update
    ) as DefineTableSchemaResult<TTable, TCoerce, TOptions>["update"],
  }
}

export type { DefineTableSchemaOptions, DefineTableSchemaResult }
export { defineTableSchema }
