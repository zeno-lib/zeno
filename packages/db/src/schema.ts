// https://orm.drizzle.team/docs/rls#using-with-supabase  (re-exported roles, authUid, realtimeMessages)
import { Column, getColumnTable, getTableName, is, sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  bigint,
  type ExtraConfigColumn,
  type HasIdentity,
  integer,
  type PgBigInt53Builder,
  type PgBigInt64Builder,
  type PgIntegerBuilder,
  type PgPolicyConfig,
  type PgTimestampBuilder,
  type PgTimestampStringBuilder,
  type PgUUIDBuilder,
  type Precision,
  pgPolicy,
  type ReferenceConfig,
  type SetHasDefault,
  type SetIsPrimaryKey,
  type SetNotNull,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { snakeCase } from "drizzle-orm/pg-core/casing"
import { authenticatedRole, authUid } from "drizzle-orm/supabase"
import { authUsers } from "./auth-schema.ts"
import {
  DEFAULT_FUNCTION_PREFIX,
  FUNCTION_POLICY_OPERATIONS,
  type FunctionPolicyOperation,
  functionPolicyName,
} from "./function-names.ts"

// pg-core primitives without the `pg` prefix they repeat at every call site.
// `table` is missing on purpose. Zeno's own is at the bottom of this file.
// biome-ignore lint/performance/noBarrelFile: intentional public re-export surface
export {
  isPgEnum as isEnum,
  isPgMaterializedView as isMaterializedView,
  isPgSchema as isSchema,
  isPgSequence as isSequence,
  isPgView as isView,
  pgEnum as enum,
  pgMaterializedView as materializedView,
  pgPolicy as policy,
  pgRole as role,
  pgSequence as sequence,
  pgTableCreator as tableCreator,
  pgView as view,
} from "drizzle-orm/pg-core"

// Supabase roles, auth.users and SQL helpers, re-exported so a schema file
// imports everything it needs from here.
export {
  anonRole,
  authenticatedRole,
  authUid,
  postgresRole,
  realtimeMessages,
  realtimeTopic,
  serviceRole,
  supabaseAuthAdminRole,
} from "drizzle-orm/supabase"

/** How a timestamp column is read back: a `Date` (the default) or Postgres's own text. */
export type TimestampMode = "date" | "string"

export type TimestampsOptions<TMode extends TimestampMode = "date"> = {
  /**
   * `"date"` (the default) reads a `Date`; `"string"` keeps Postgres's text
   * form, which also keeps the microseconds a `Date` truncates. A JavaScript
   * mapping only: it emits no SQL.
   */
  mode?: TMode
  withTimezone?: boolean
  /** Fractional-second digits. Postgres allows 0 to 6. */
  precision?: Precision
}

// Mirrors drizzle's own `timestamp()` overload: only an exact `"string"` gives
// the string builder.
type TimestampColumn<TMode extends TimestampMode> = SetHasDefault<
  SetNotNull<
    [TMode] extends ["string"] ? PgTimestampStringBuilder : PgTimestampBuilder
  >
>

export type TimestampColumns<TMode extends TimestampMode = "date"> = {
  createdAt: TimestampColumn<TMode>
  updatedAt: TimestampColumn<TMode>
}

// `created_at` is a column DEFAULT, so Postgres fills it for every writer.
// `updated_at` has no equivalent: SQL has no "on update" default, and Drizzle's
// `$onUpdateFn` is applied while Drizzle builds its own statement, so a write
// arriving through PostgREST never runs it. In a Supabase app that is most
// writes, which made the hook a column half Drizzle claimed and never
// maintained. It is gone: `updatedAtTrigger` from `@zeno-lib/db/triggers` puts
// the column in Postgres's hands, where every writer reaches it.
//
// Call and spread into a column map. Every audit mixin here is a factory rather
// than a shared object, because Drizzle's builder methods mutate `this` and
// return it. One builder in two tables would leak `.notNull()`, `.references()`
// and its name from whichever table customised it first.
export const timestamps = <TMode extends TimestampMode = "date">({
  mode,
  precision,
  withTimezone = true,
}: TimestampsOptions<TMode> = {}): TimestampColumns<TMode> => {
  const column = (name: string) =>
    mode === "string"
      ? timestamp(name, { mode: "string", precision, withTimezone })
          .notNull()
          .defaultNow()
      : timestamp(name, { precision, withTimezone }).notNull().defaultNow()

  return {
    createdAt: column("created_at"),
    updatedAt: column("updated_at"),
  } as TimestampColumns<TMode>
}

type ReferenceActions = ReferenceConfig["config"]

// An audit row outlives its author, so the reference blanks rather than
// blocking the delete. `set null` against a NOT NULL column is a foreign key
// that can never fire, so a required author restricts the delete instead: still
// the old behaviour, but now because you asked for it.
const NULLABLE_AUTHOR_ACTIONS = {
  onDelete: "set null",
  onUpdate: "cascade",
} as const satisfies ReferenceActions

const REQUIRED_AUTHOR_ACTIONS = {
  onDelete: "restrict",
  onUpdate: "cascade",
} as const satisfies ReferenceActions

// `[T] extends [U]` blocks distribution, so a plain `boolean` gives one column
// type rather than a union of both.
type AuthorColumn<TNotNull extends boolean> = [TNotNull] extends [true]
  ? SetNotNull<PgUUIDBuilder>
  : PgUUIDBuilder

// `actions` is meaningless without a reference, the same way
// `sequentialPrimaryId` rejects `mode` for an integer key.
type AuthorReference =
  | { reference?: () => AnyPgColumn; actions?: ReferenceActions }
  | { reference: null; actions?: never }

export type AuthorshipOptions<TNotNull extends boolean = false> =
  AuthorReference & { notNull?: TNotNull }

// The loose shape the implementation signatures take. Callers only ever see the
// overload above each helper.
type AuthorColumnConfig = {
  name?: string
  reference?: (() => AnyPgColumn) | null
  actions?: ReferenceActions
  notNull?: boolean
}

const authorColumn = ({
  name,
  reference = () => authUsers.id,
  actions,
  notNull = false,
}: AuthorColumnConfig) => {
  const column =
    reference === null
      ? uuid(name)
      : uuid(name).references(
          reference,
          actions ??
            (notNull ? REQUIRED_AUTHOR_ACTIONS : NULLABLE_AUTHOR_ACTIONS)
        )

  return notNull ? column.notNull() : column
}

// Nullable by default: a required reference to auth.users means deleting the
// user fails, because the audit trail holds the row.
export function authUserId<TNotNull extends boolean = false>(
  options?: AuthorshipOptions<TNotNull> & { name?: string }
): AuthorColumn<TNotNull>
export function authUserId(options: AuthorColumnConfig = {}) {
  return authorColumn(options)
}

// RLS policies and PostgREST joins cannot read auth.users, so applications
// mirror it into a public `profiles` table. This points at that instead.
export function userId<TNotNull extends boolean = false>(
  reference: () => AnyPgColumn,
  options?: {
    name?: string
    actions?: ReferenceActions
    notNull?: TNotNull
  }
): AuthorColumn<TNotNull>
export function userId(
  reference: () => AnyPgColumn,
  options: AuthorColumnConfig = {}
) {
  return authorColumn({ ...options, reference })
}

// `authUid` is `(select auth.uid())`, which is right for a policy predicate
// (the wrapper lets the planner evaluate it once per statement) but invalid in
// a column DEFAULT: Postgres rejects a subquery there with
// "cannot use subquery in DEFAULT expression". The bare call is what a DEFAULT
// takes, and it resolves the same request.jwt.claims setting.
const AUTH_UID_DEFAULT = sql`auth.uid()`

export function createdBy<TNotNull extends boolean = false>(
  options?: AuthorshipOptions<TNotNull>
): SetHasDefault<AuthorColumn<TNotNull>>
export function createdBy(options: AuthorColumnConfig = {}) {
  return authorColumn({ ...options, name: "created_by" }).default(
    AUTH_UID_DEFAULT
  )
}

export function updatedBy<TNotNull extends boolean = false>(
  options?: AuthorshipOptions<TNotNull>
): SetHasDefault<AuthorColumn<TNotNull>>
export function updatedBy(options: AuthorColumnConfig = {}) {
  // The DEFAULT covers the insert for every writer. The update side is
  // `updatedByTrigger`, for the same reason `updated_at` needs one.
  return authorColumn({ ...options, name: "updated_by" }).default(
    AUTH_UID_DEFAULT
  )
}

// One options object covers both columns. A table that needs them to differ
// calls `createdBy()` and `updatedBy()` separately, which also covers a schema
// with `created_by` and no `updated_by`.
export const authorship = <TNotNull extends boolean = false>(
  options?: AuthorshipOptions<TNotNull>
) => ({
  createdBy: createdBy<TNotNull>(options),
  updatedBy: updatedBy<TNotNull>(options),
})

// Takes both halves' options, since it builds both halves.
export const auditColumns = <
  TNotNull extends boolean = false,
  TMode extends TimestampMode = "date",
>(
  options: AuthorshipOptions<TNotNull> & TimestampsOptions<TMode> = {}
) => ({
  ...timestamps<TMode>(options),
  ...authorship<TNotNull>(options),
})

const DEFAULT_ID_NAME = "id"

// `[T] extends [U]` blocks distribution, so a plain `boolean` gives one column
// type rather than a union of both.
type UuidPrimaryIdColumn<TDefaultRandom extends boolean> = [
  TDefaultRandom,
] extends [false]
  ? SetIsPrimaryKey<PgUUIDBuilder>
  : SetHasDefault<SetIsPrimaryKey<PgUUIDBuilder>>

// `defaultRandom: false` when the id comes from elsewhere. A mirror of
// auth.users takes its id from the referenced row, and skipping the default
// also makes the column required on insert.
export function uuidPrimaryId<TDefaultRandom extends boolean = true>(options?: {
  name?: string
  defaultRandom?: TDefaultRandom
}): UuidPrimaryIdColumn<TDefaultRandom>
export function uuidPrimaryId(
  options: { name?: string; defaultRandom?: boolean } = {}
) {
  const { name = DEFAULT_ID_NAME, defaultRandom = true } = options
  const column = uuid(name).primaryKey()

  return defaultRandom ? column.defaultRandom() : column
}

type IdentityType = "integer" | "bigint"
type IdentityMode = "number" | "bigint"
type IdentityGeneration = "byDefault" | "always"

type IdentityBuilder<
  TType extends IdentityType,
  TMode extends IdentityMode,
> = TType extends "integer"
  ? PgIntegerBuilder
  : TMode extends "bigint"
    ? PgBigInt64Builder
    : PgBigInt53Builder

type SequentialPrimaryIdColumn<
  TType extends IdentityType,
  TMode extends IdentityMode,
  TGeneration extends IdentityGeneration,
> = HasIdentity<SetIsPrimaryKey<IdentityBuilder<TType, TMode>>, TGeneration>

// Defaults match the Supabase table editor: bigint, generated by default as
// identity. Option names follow Postgres, which calls this an identity column.
// `mode` is "number" because PostgREST serialises to JSON numbers.
export function sequentialPrimaryId<
  TType extends IdentityType = "bigint",
  TMode extends IdentityMode = "number",
  TGeneration extends IdentityGeneration = "byDefault",
>(
  options: {
    name?: string
    type?: TType
    // `never` for integer, which has one JavaScript representation.
    mode?: TType extends "integer" ? never : TMode
    generated?: TGeneration
  } = {}
): SequentialPrimaryIdColumn<TType, TMode, TGeneration> {
  const {
    name = DEFAULT_ID_NAME,
    type = "bigint",
    mode = "number",
    generated = "byDefault",
  } = options as {
    name?: string
    type?: IdentityType
    mode?: IdentityMode
    generated?: IdentityGeneration
  }
  const column =
    type === "integer"
      ? integer(name).primaryKey()
      : bigint(name, { mode }).primaryKey()

  // TypeScript can't follow the runtime branch. A single cast is rejected too,
  // because Drizzle types `$default` off a polymorphic `this`, which leaves the
  // concrete builders unassignable to the intersected return type.
  return (generated === "always"
    ? column.generatedAlwaysAsIdentity()
    : column.generatedByDefaultAsIdentity()) as unknown as SequentialPrimaryIdColumn<
    TType,
    TMode,
    TGeneration
  >
}

export const assignedPrimaryId = ({
  name = DEFAULT_ID_NAME,
  length,
}: {
  name?: string
  length?: number
} = {}) => varchar(name, { length }).primaryKey()

type PrimaryIdKind = "uuid" | "sequential" | "assigned"

type PrimaryIdColumn<TKind extends PrimaryIdKind> = TKind extends "uuid"
  ? UuidPrimaryIdColumn<true>
  : TKind extends "sequential"
    ? SequentialPrimaryIdColumn<"bigint", "number", "byDefault">
    : ReturnType<typeof assignedPrimaryId>

// Takes the kind and nothing else, so it can't regrow the overload set it
// replaced. Renaming a column or changing how the value is generated goes
// through the helper behind the kind. "sequential" is the default because it is
// the id the Supabase table editor gives a new table.
export function primaryId<TKind extends PrimaryIdKind = "sequential">(
  kind?: TKind
): PrimaryIdColumn<TKind>
export function primaryId(kind: PrimaryIdKind = "sequential") {
  if (kind === "uuid") {
    return uuidPrimaryId()
  }

  if (kind === "assigned") {
    return assignedPrimaryId()
  }

  return sequentialPrimaryId()
}

type PolicyOptions = Omit<PgPolicyConfig, "for">
type PolicyOperation = NonNullable<PgPolicyConfig["for"]>
type AuthenticatedPolicyOptions = Omit<PgPolicyConfig, "for" | "to">

function operationPolicy(
  name: string,
  operation: PolicyOperation,
  config: PolicyOptions = {}
) {
  return pgPolicy(name, { ...config, for: operation })
}

export const selectPolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "select", config)

export const insertPolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "insert", config)

export const updatePolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "update", config)

export const deletePolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "delete", config)

export const allPolicy = (name: string, config: PolicyOptions = {}) =>
  operationPolicy(name, "all", config)

// `to: authenticatedRole` on its own, which every hand-written policy repeats.
// The condition stays yours, unlike the owner helpers below.
export const authenticatedSelectPolicy = (
  name: string,
  config: AuthenticatedPolicyOptions = {}
) => selectPolicy(name, { ...config, to: authenticatedRole })

export const authenticatedInsertPolicy = (
  name: string,
  config: AuthenticatedPolicyOptions = {}
) => insertPolicy(name, { ...config, to: authenticatedRole })

export const authenticatedUpdatePolicy = (
  name: string,
  config: AuthenticatedPolicyOptions = {}
) => updatePolicy(name, { ...config, to: authenticatedRole })

export const authenticatedDeletePolicy = (
  name: string,
  config: AuthenticatedPolicyOptions = {}
) => deletePolicy(name, { ...config, to: authenticatedRole })

export const authenticatedAllPolicy = (
  name: string,
  config: AuthenticatedPolicyOptions = {}
) => allPolicy(name, { ...config, to: authenticatedRole })

// The clause each operation's condition belongs in: `using` filters the rows
// already there, `withCheck` vets the rows going in. `update` and `all` accept
// both, but Postgres reuses `using` for the check when `withCheck` is left out,
// so one clause says the same thing and leaves the catalog matching the
// `USING`-only policies `drizzle-kit pull` reads back from an existing database.
const POLICY_CLAUSE = {
  all: "using",
  delete: "using",
  insert: "withCheck",
  select: "using",
  update: "using",
} as const satisfies Record<PolicyOperation, "using" | "withCheck">

const POLICY_BUILDERS = {
  all: allPolicy,
  delete: deletePolicy,
  insert: insertPolicy,
  select: selectPolicy,
  update: updatePolicy,
} as const satisfies Record<PolicyOperation, typeof selectPolicy>

/** Columns one function is called with. `null` calls it with none. */
type FunctionArgument = AnyPgColumn | readonly AnyPgColumn[] | null

type FunctionPoliciesOptions = {
  /**
   * Passed to each function, e.g. the row's id: one column, an array for a
   * function taking several, or a record to vary them per operation. The
   * common shape is that the row-scoped operations take the row and `insert`
   * takes nothing, there being no row yet to authorise, only the caller. An
   * operation missing from the record, or set to `null`, is called with no
   * arguments; so is every operation when `argument` is omitted.
   */
  argument?:
    | FunctionArgument
    | Partial<Record<FunctionPolicyOperation, FunctionArgument>>
  /**
   * Schema the functions live in, e.g. `"billing"` for
   * `billing.can_select_invoices`. Omit to emit the name unqualified and let
   * the `search_path` in effect resolve it.
   */
  schema?: string
  /** Prefix for the default function and policy names. Default `"can"`. */
  prefix?: string
  /** Overrides the generated policy name. */
  name?: (operation: PolicyOperation, table: string) => string
}

// A column and an array of them are the whole-set form; anything else is the
// per-operation record. `is` is how drizzle asks "is this one of mine", and a
// column is the only entity either form can hold.
const isWholeSetArgument = (
  argument: NonNullable<FunctionPoliciesOptions["argument"]>
): argument is NonNullable<FunctionArgument> =>
  is(argument, Column) || Array.isArray(argument)

const argumentsFor = (
  argument: FunctionPoliciesOptions["argument"],
  operation: FunctionPolicyOperation
): AnyPgColumn[] => {
  if (!argument) {
    return []
  }

  const forOperation = isWholeSetArgument(argument)
    ? argument
    : argument[operation]

  if (!forOperation) {
    return []
  }

  return is(forOperation, Column) ? [forOperation] : [...forOperation]
}

// The columns object drizzle hands the extra-config callback. Taking it rather
// than the table is what keeps `functionPolicies` usable: naming the table
// inside its own definition makes its type circular, so `(t) => ...` is the
// only reference available at that point.
type ExtraConfigColumns = Record<string, ExtraConfigColumn>

/**
 * One policy per operation, each delegating to a `security definer` function.
 *
 * Access rarely depends only on the row's own owner column, and the usual
 * answer is a function, which is also the standard advice for keeping RLS
 * predicates out of the planner's way:
 *
 * ```ts
 * table("posts", { id: primaryId("uuid") }, (t) =>
 *   functionPolicies(t, { argument: t.id })
 * )
 * ```
 *
 * ```sql
 * CREATE POLICY "can_select_posts" ON "posts" FOR SELECT TO "authenticated"
 *   USING ((select "can_select_posts"("posts"."id")));
 * ```
 *
 * `argument` also takes a record, for the usual shape where `insert` has no
 * row to authorise yet:
 *
 * ```ts
 * functionPolicies(t, {
 *   argument: { delete: t.id, select: t.id, update: t.id },
 * })
 * ```
 */
export const functionPolicies = (
  columns: ExtraConfigColumns,
  {
    argument,
    name,
    prefix = DEFAULT_FUNCTION_PREFIX,
    schema: functionSchema,
  }: FunctionPoliciesOptions = {}
) => {
  const [firstColumn] = Object.values(columns)

  if (!firstColumn) {
    throw new Error("functionPolicies needs a table with at least one column")
  }

  const tableName = getTableName(getColumnTable(firstColumn))

  return FUNCTION_POLICY_OPERATIONS.map((operation) => {
    const functionName = functionPolicyName(prefix, operation, tableName)
    // Unqualified by default, so the name resolves through `search_path` the
    // way a hand-written policy would; `schema` pins it to the functions that
    // live beside their table instead.
    const callee = functionSchema
      ? sql`${sql.identifier(functionSchema)}.${sql.identifier(functionName)}`
      : sql`${sql.identifier(functionName)}`
    // `select` wraps it so Postgres evaluates the call once per statement
    // rather than once per row, the same shape `authUid` uses.
    const condition = sql`(select ${callee}(${sql.join(argumentsFor(argument, operation), sql`, `)}))`
    const clause = { [POLICY_CLAUSE[operation]]: condition }

    return POLICY_BUILDERS[operation](
      name?.(operation, tableName) ?? functionName,
      { to: authenticatedRole, ...clause }
    )
  })
}

export const authUserOwns = (ownerColumn: AnyPgColumn) =>
  sql`${ownerColumn} = ${authUid}`

type OwnerPolicyOptions = Omit<PgPolicyConfig, "for" | "to">

export const authenticatedOwnerSelectPolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) =>
  selectPolicy(name, {
    ...config,
    to: authenticatedRole,
    using: config.using ?? authUserOwns(ownerColumn),
  })

export const authenticatedOwnerInsertPolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) =>
  insertPolicy(name, {
    ...config,
    to: authenticatedRole,
    withCheck: config.withCheck ?? authUserOwns(ownerColumn),
  })

export const authenticatedOwnerUpdatePolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) => {
  const ownerCondition = authUserOwns(ownerColumn)
  return updatePolicy(name, {
    ...config,
    to: authenticatedRole,
    using: config.using ?? ownerCondition,
    withCheck: config.withCheck ?? ownerCondition,
  })
}

export const authenticatedOwnerDeletePolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) =>
  deletePolicy(name, {
    ...config,
    to: authenticatedRole,
    using: config.using ?? authUserOwns(ownerColumn),
  })

export const authenticatedOwnerAllPolicy = (
  name: string,
  ownerColumn: AnyPgColumn,
  config: OwnerPolicyOptions = {}
) => {
  const ownerCondition = authUserOwns(ownerColumn)
  return allPolicy(name, {
    ...config,
    to: authenticatedRole,
    using: config.using ?? ownerCondition,
    withCheck: config.withCheck ?? ownerCondition,
  })
}

// Application-owned tables. Column keys stay camelCase, database identifiers
// become snake_case, and RLS is on.
export const table = snakeCase.table.withRLS

// Escape hatch for intentionally non-RLS tables such as seed/reference data.
export const unsecureTable = snakeCase.table

// A non-public schema, with the same two guarantees `table` and `unsecureTable`
// give at the top level. Drizzle's own `pgSchema(name)` takes no casing
// argument, so a schema built with it names every column after its TypeScript
// key; `snakeCase.schema` is the cased factory behind the same class.
// `.table` enables RLS and `.unsecureTable` is the escape hatch, so a table in
// a second schema doesn't have to remember `.withRLS`.
export const schema = <TName extends string>(name: TName) => {
  const built = snakeCase.schema(name)

  // `Object.assign` mutates and returns the PgSchema instance, so `isSchema`
  // and the `entityKind` checks drizzle-kit runs still recognise it.
  return Object.assign(built, {
    table: built.table.withRLS,
    unsecureTable: built.table,
  })
}
