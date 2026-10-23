// https://orm.drizzle.team/docs/rls#using-with-supabase  (re-exported roles, authUid, realtimeMessages)
import {
  type BuildColumn,
  Column,
  getColumnTable,
  getTableName,
  is,
  sql,
} from "drizzle-orm"
import {
  type AnyPgColumn,
  type AnyPgColumnBuilder,
  bigint,
  type ExtraConfigColumn,
  type HasIdentity,
  integer,
  numeric,
  type PgBigInt53Builder,
  type PgBigInt64Builder,
  type PgBuildColumns,
  type PgBuildExtraConfigColumns,
  type PgIntegerBuilder,
  type PgPolicyConfig,
  type PgSchema,
  type PgTableExtraConfig,
  type PgTableExtraConfigValue,
  type PgTableFnInternal,
  type PgTableWithColumns,
  type PgTimestampBuilder,
  type PgTimestampStringBuilder,
  type PgUUIDBuilder,
  type Precision,
  pgPolicy,
  type ReferenceConfig,
  type SetHasDefault,
  type SetIsPrimaryKey,
  type SetNotNull,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { snakeCase } from "drizzle-orm/pg-core/casing"
import type { PgColumnsBuilders } from "drizzle-orm/pg-core/columns/all"
import { authenticatedRole, authUid } from "drizzle-orm/supabase"
import type { GetZodType } from "drizzle-orm/zod"
import type { z } from "zod"
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

// The key a table carries its column rules under. `@zeno-lib/schema` reads it
// by name (`COLUMN_RULES_KEY`), because neither package imports the other;
// `src/column-rules.test.ts` fails if the two drift.
const COLUMN_RULES_KEY = "~zeno"

// Who writes a column, when a client doesn't: server code (`serverOwned`), or
// only the database, through a default and a trigger (the audit columns).
type WriterRule<TWriter extends "database" | "server"> = {
  readonly writer: TWriter
}
type RefineRule<TRefine> = {
  readonly refine: TRefine
  readonly hint?: FieldHint
}

/**
 * What a column tells the form field that edits it, beside its rule:
 * `{ field: "percentage", scale: "fraction" }` has `PercentageField` from
 * `@zeno-lib/forms` show a stored `0.25` as 25 %. The field takes its bounds
 * from the rule itself.
 */
export type FieldHint = {
  readonly field: string
  readonly [key: string]: unknown
}
type ColumnRule = Partial<
  WriterRule<"database" | "server"> & RefineRule<unknown>
>

type WithColumnRule<TBuilder, TRule extends ColumnRule> = TBuilder & {
  readonly [COLUMN_RULES_KEY]: TRule
}

const SERVER_OWNED = { writer: "server" } as const satisfies ColumnRule
const DATABASE_OWNED = { writer: "database" } as const satisfies ColumnRule

// Drizzle builders mutate `this` and their methods return it, typed as an
// intersection with `this`, so a marker survives the calls chained after it.
// A second marker adds to the first, so `serverOwned(percentage())` keeps the
// rule for the server-side schema. Two writers can't share a column.
const markColumn = <
  TBuilder extends AnyPgColumnBuilder,
  TRule extends ColumnRule,
>(
  builder: TBuilder,
  rule: TRule
) => {
  const current = (builder as { [COLUMN_RULES_KEY]?: ColumnRule })[
    COLUMN_RULES_KEY
  ]

  if (
    current?.writer !== undefined &&
    rule.writer !== undefined &&
    current.writer !== rule.writer
  ) {
    throw new TypeError(
      `A column the ${current.writer} writes can't also be written by the ${rule.writer}.`
    )
  }

  return Object.assign(builder, {
    [COLUMN_RULES_KEY]: { ...current, ...rule },
  }) as WithColumnRule<TBuilder, TRule>
}

/**
 * A column only the server writes: a trigger, a `DEFAULT` such as
 * `auth.uid()`, or an action of its own. `defineTableSchema` leaves it out of
 * insert and update, so no form or action input accepts it, and
 * `defineServerTableSchema` keeps it, for server code that sets it. An audit
 * column, which the database writes, can't take it.
 */
export const serverOwned = <
  TBuilder extends AnyPgColumnBuilder & {
    readonly [COLUMN_RULES_KEY]?: Partial<
      WriterRule<"server"> & RefineRule<unknown>
    >
  },
>(
  builder: TBuilder
) => markColumn(builder, SERVER_OWNED)

// The schema drizzle's Zod bridge generates for the column, before it adds
// `.nullable()` or `.optional()`: what a function refinement receives.
type ColumnSchema<TBuilder extends AnyPgColumnBuilder> = GetZodType<
  BuildColumn<string, TBuilder, "common">,
  undefined
>

// A rule checks one value, and `.array()` mutates the builder it is called on,
// so chained after `withRule` it would turn the rule on the array instead.
type RuledColumn<TBuilder, TRefine> = WithColumnRule<
  TBuilder,
  RefineRule<TRefine>
> & { readonly array: never }

const arrayAfterRule = () => {
  throw new TypeError(
    "A column rule checks one value: call .array() before withRule(), and write the rule for the array."
  )
}

/**
 * A rule `defineTableSchema` applies to the column in insert and update: a
 * function from the schema the column generates, typed from it
 * (`z.ZodNumber` for a `numeric({ mode: "number" })`). It runs before
 * `.nullable()` and `.optional()`, so a nullable column stays nullable. A
 * function the caller passes for the same column runs on top of it; a Zod
 * schema replaces it, rule included. `hint` goes to the form field that edits
 * the column.
 */
export const withRule = <
  TBuilder extends AnyPgColumnBuilder,
  TRefine extends (schema: ColumnSchema<TBuilder>) => z.ZodType,
>(
  builder: TBuilder,
  refine: TRefine,
  hint?: FieldHint
) =>
  Object.defineProperty(markColumn(builder, { hint, refine }), "array", {
    configurable: true,
    value: arrayAfterRule,
  }) as RuledColumn<TBuilder, TRefine>

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

// The database writes the audit columns, through a default and a trigger, so
// they leave every derived insert and update schema, server-side ones too.
type AuditColumn<TBuilder> = WithColumnRule<TBuilder, typeof DATABASE_OWNED>

export type TimestampColumns<TMode extends TimestampMode = "date"> = {
  createdAt: AuditColumn<TimestampColumn<TMode>>
  updatedAt: AuditColumn<TimestampColumn<TMode>>
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
    markColumn(
      mode === "string"
        ? timestamp(name, { mode: "string", precision, withTimezone })
            .notNull()
            .defaultNow()
        : timestamp(name, { precision, withTimezone }).notNull().defaultNow(),
      DATABASE_OWNED
    )

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

// `authUid` is `(select auth.uid())`, which is right for a policy predicate
// (the wrapper lets the planner evaluate it once per statement) but invalid in
// a column DEFAULT: Postgres rejects a subquery there with
// "cannot use subquery in DEFAULT expression". The bare call is what a DEFAULT
// takes, and it resolves the same request.jwt.claims setting.
const AUTH_UID_DEFAULT = sql`auth.uid()`

type AuthUserIdColumn<
  TNotNull extends boolean,
  TDefaultToCurrentUser extends boolean,
> = [TDefaultToCurrentUser] extends [false]
  ? AuthorColumn<TNotNull>
  : // A flag only known at runtime types as an owner column, the safe side.
    WithColumnRule<SetHasDefault<AuthorColumn<TNotNull>>, typeof SERVER_OWNED>

// Nullable by default: a required reference to auth.users means deleting the
// user fails, because the audit trail holds the row.
//
// `defaultToCurrentUser` makes it an owner column: the signed-in user by
// default, and server-owned, so no client picks the owner. The marker has to
// come from here, because a `.default(...)` chained afterwards can't add it.
export function authUserId<
  TNotNull extends boolean = false,
  TDefaultToCurrentUser extends boolean = false,
>(
  options?: AuthorshipOptions<TNotNull> & {
    name?: string
    defaultToCurrentUser?: TDefaultToCurrentUser
  }
): AuthUserIdColumn<TNotNull, TDefaultToCurrentUser>
export function authUserId({
  defaultToCurrentUser = false,
  ...options
}: AuthorColumnConfig & { defaultToCurrentUser?: boolean } = {}) {
  const column = authorColumn(options)

  return defaultToCurrentUser
    ? markColumn(column.default(AUTH_UID_DEFAULT), SERVER_OWNED)
    : column
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

export function createdBy<TNotNull extends boolean = false>(
  options?: AuthorshipOptions<TNotNull>
): AuditColumn<SetHasDefault<AuthorColumn<TNotNull>>>
export function createdBy(options: AuthorColumnConfig = {}) {
  return markColumn(
    authorColumn({ ...options, name: "created_by" }).default(AUTH_UID_DEFAULT),
    DATABASE_OWNED
  )
}

export function updatedBy<TNotNull extends boolean = false>(
  options?: AuthorshipOptions<TNotNull>
): AuditColumn<SetHasDefault<AuthorColumn<TNotNull>>>
export function updatedBy(options: AuthorColumnConfig = {}) {
  // The DEFAULT covers the insert for every writer. The update side is
  // `updatedByTrigger`, for the same reason `updated_at` needs one.
  return markColumn(
    authorColumn({ ...options, name: "updated_by" }).default(AUTH_UID_DEFAULT),
    DATABASE_OWNED
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

export type PercentageOptions = {
  name?: string
  /**
   * How 25 % is stored: `"fraction"` (the default) stores `0.25`, `"percent"`
   * stores `25`. The form's `PercentageField` takes the same prop.
   */
  scale?: "fraction" | "percent"
  /** The lowest value insert and update accept, in the stored scale. `0` by default. */
  min?: number
  /**
   * The highest value insert and update accept, in the stored scale: `1` for
   * a fraction and `100` for a percent by default.
   */
  max?: number
}

// A share as a `numeric`, between 0 and 100 % unless the bounds say otherwise:
// a rate can go negative, and some ratios exceed 100 %.
export const percentage = ({
  name,
  scale = "fraction",
  min = 0,
  max = scale === "fraction" ? 1 : 100,
}: PercentageOptions = {}) =>
  withRule(
    name === undefined
      ? numeric({ mode: "number" })
      : numeric(name, { mode: "number" }),
    (base) => base.min(min).max(max),
    // `PercentageField` from `@zeno-lib/forms` reads it, and clamps to the
    // rule's bounds, so a form shows what the column accepts with no props.
    { field: "percentage", scale }
  )

export type YearOptions = {
  name?: string
  /** `0` by default. */
  min?: number
  /** `9999` by default, the four digits a year field takes. */
  max?: number
}

// A calendar year as a `smallint`, so a whole number.
export const year = ({ name, min = 0, max = 9999 }: YearOptions = {}) =>
  withRule(
    name === undefined ? smallint() : smallint(name),
    (base) => base.min(min).max(max),
    // `YearField` from `@zeno-lib/forms` clamps to the rule's bounds.
    { field: "year" }
  )

// An email address as `text`, checked as `z.email()` checks it.
// `ZodString.email()` runs the same check, and keeps Zod a type-only import
// here.
export const email = ({ name }: { name?: string } = {}) =>
  withRule(name === undefined ? text() : text(name), (base) => base.email())

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

type SequentialIdColumn<
  TType extends IdentityType,
  TMode extends IdentityMode,
  TGeneration extends IdentityGeneration,
> = HasIdentity<IdentityBuilder<TType, TMode>, TGeneration>

type SequentialPrimaryIdColumn<
  TType extends IdentityType,
  TMode extends IdentityMode,
  TGeneration extends IdentityGeneration,
> = HasIdentity<SetIsPrimaryKey<IdentityBuilder<TType, TMode>>, TGeneration>

type SequentialIdOptions<
  TType extends IdentityType,
  TMode extends IdentityMode,
  TGeneration extends IdentityGeneration,
> = {
  name?: string
  type?: TType
  // `never` for integer, which has one JavaScript representation.
  mode?: TType extends "integer" ? never : TMode
  generated?: TGeneration
}

// Defaults match the Supabase table editor: bigint, generated by default as
// identity. Option names follow Postgres, which calls this an identity column.
// `mode` is "number" because PostgREST serialises to JSON numbers.
//
// Not a primary key, for a table whose key spans more columns than the id.
export function sequentialId<
  TType extends IdentityType = "bigint",
  TMode extends IdentityMode = "number",
  TGeneration extends IdentityGeneration = "byDefault",
>(
  options: SequentialIdOptions<TType, TMode, TGeneration> = {}
): SequentialIdColumn<TType, TMode, TGeneration> {
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
  const column = type === "integer" ? integer(name) : bigint(name, { mode })

  // TypeScript can't follow the runtime branch. A single cast is rejected too,
  // because Drizzle types `$default` off a polymorphic `this`, which leaves the
  // concrete builders unassignable to the intersected return type.
  return (generated === "always"
    ? column.generatedAlwaysAsIdentity()
    : column.generatedByDefaultAsIdentity()) as unknown as SequentialIdColumn<
    TType,
    TMode,
    TGeneration
  >
}

// `sequentialId()` as the primary key, the id the Supabase table editor gives a
// new table.
export function sequentialPrimaryId<
  TType extends IdentityType = "bigint",
  TMode extends IdentityMode = "number",
  TGeneration extends IdentityGeneration = "byDefault",
>(
  options: SequentialIdOptions<TType, TMode, TGeneration> = {}
): SequentialPrimaryIdColumn<TType, TMode, TGeneration> {
  return sequentialId(
    options
  ).primaryKey() as unknown as SequentialPrimaryIdColumn<
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

type ColumnRuleOf<TBuilder> = TBuilder extends {
  readonly [COLUMN_RULES_KEY]: infer TRule
}
  ? TRule
  : never

// Read from the builders, before drizzle builds the columns: its column config
// copies a fixed set of builder fields, so the markers never reach the
// column types.
type ColumnRules<TColumnsMap> = {
  readonly [K in keyof TColumnsMap as [ColumnRuleOf<TColumnsMap[K]>] extends [
    never,
  ]
    ? never
    : K]: ColumnRuleOf<TColumnsMap[K]>
}

type TableWithColumnRules<
  TTableName extends string,
  TSchema extends string | undefined,
  TColumnsMap extends Record<string, AnyPgColumnBuilder>,
> = PgTableWithColumns<{
  name: TTableName
  schema: TSchema
  columns: PgBuildColumns<TTableName, TColumnsMap>
  dialect: "pg"
  isAlias: false
}> & {
  readonly [COLUMN_RULES_KEY]: { readonly columns: ColumnRules<TColumnsMap> }
}

type ExtraConfig<TColumnsMap extends Record<string, AnyPgColumnBuilder>> = (
  self: PgBuildExtraConfigColumns<TColumnsMap>
) =>
  | (PgTableExtraConfigValue | PgTableExtraConfigValue[])[]
  | PgTableExtraConfig

/** Drizzle's table function, recording each column's rule on the table. */
export type TableFn<TSchema extends string | undefined = undefined> = <
  TTableName extends string,
  TColumnsMap extends Record<string, AnyPgColumnBuilder>,
>(
  name: TTableName,
  columns: TColumnsMap | ((columnTypes: PgColumnsBuilders) => TColumnsMap),
  extraConfig?: ExtraConfig<TColumnsMap>
) => TableWithColumnRules<TTableName, TSchema, TColumnsMap>

type ColumnsArgument =
  | Record<string, AnyPgColumnBuilder>
  | ((columnTypes: PgColumnsBuilders) => Record<string, AnyPgColumnBuilder>)

const readColumnRules = (builders: Record<string, AnyPgColumnBuilder>) => {
  const rules: Record<string, ColumnRule> = {}

  for (const [key, builder] of Object.entries(builders)) {
    const rule = (builder as { [COLUMN_RULES_KEY]?: ColumnRule })[
      COLUMN_RULES_KEY
    ]

    if (rule !== undefined) {
      rules[key] = rule
    }
  }

  return rules
}

// Drizzle builds the table exactly as before. For the callback form, it calls
// the callback once, synchronously, so wrapping it is enough to see the
// builders without importing drizzle's column factory.
const withColumnRules = <TSchema extends string | undefined>(
  create: PgTableFnInternal<TSchema>
): TableFn<TSchema> => {
  const createAny = create as unknown as (
    name: string,
    columns: ColumnsArgument,
    extraConfig?: unknown
  ) => object

  return ((name: string, columns: ColumnsArgument, extraConfig?: unknown) => {
    let builders: Record<string, AnyPgColumnBuilder> = {}
    const built = createAny(
      name,
      typeof columns === "function"
        ? (columnTypes: PgColumnsBuilders) => {
            builders = columns(columnTypes)
            return builders
          }
        : columns,
      extraConfig
    )

    if (typeof columns !== "function") {
      builders = columns
    }

    // Not enumerable, so nothing that walks a table's own keys for its
    // columns ever meets it.
    return Object.defineProperty(built, COLUMN_RULES_KEY, {
      value: { columns: readColumnRules(builders) },
    })
  }) as unknown as TableFn<TSchema>
}

// Application-owned tables. Column keys stay camelCase, database identifiers
// become snake_case, and RLS is on.
export const table = withColumnRules(snakeCase.table.withRLS)

// Escape hatch for intentionally non-RLS tables such as seed/reference data.
export const unsecureTable = withColumnRules(snakeCase.table)

// A non-public schema, with the same two guarantees `table` and `unsecureTable`
// give at the top level. Drizzle's own `pgSchema(name)` takes no casing
// argument, so a schema built with it names every column after its TypeScript
// key; `snakeCase.schema` is the cased factory behind the same class.
// `.table` enables RLS and `.unsecureTable` is the escape hatch, so a table in
// a second schema doesn't have to remember `.withRLS`.
export const schema = <TName extends string>(name: TName) => {
  const built = snakeCase.schema(name)

  // `Object.assign` mutates and returns the PgSchema instance, so `isSchema`
  // and the `entityKind` checks drizzle-kit runs still recognise it. Its type
  // would intersect the two `table`s, and a call resolves to drizzle's, which
  // drops the column rules, so the replaced members leave the type first.
  return Object.assign(built, {
    table: withColumnRules<TName>(built.table.withRLS),
    unsecureTable: withColumnRules<TName>(built.table),
  }) as unknown as ZenoSchema<TName>
}

// `existing()` returns the schema itself, typed as drizzle's `this`, which
// the cast above would turn back into drizzle's `table`.
export type ZenoSchema<TName extends string> = Omit<
  PgSchema<TName>,
  "existing" | "table"
> & {
  existing: () => ZenoSchema<TName>
  table: TableFn<TName>
  unsecureTable: TableFn<TName>
}
