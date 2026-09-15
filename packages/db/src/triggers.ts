// SQL text for the triggers a Supabase schema wants but drizzle-kit cannot
// generate. drizzle-orm 1.0.0-rc.3 exports no trigger API and the drizzle-kit
// bundle contains no `CREATE TRIGGER`, so triggers are not part of the snapshot
// format and `drizzle-kit generate` will never emit one from your schema.
//
// What it does give you is `drizzle-kit generate --custom`, which writes an
// empty, *tracked* migration (its snapshot links into the chain via `prevIds`)
// for you to fill in. These helpers produce the SQL that goes in it, so the
// text is versioned here rather than retyped per table.
import { getTableName, is } from "drizzle-orm"
import { getTableConfig, PgTable } from "drizzle-orm/pg-core"

// Supabase installs extensions into `extensions`, not `public`.
const DEFAULT_EXTENSION_SCHEMA = "extensions"
const DEFAULT_COLUMN = "updated_at"
const DEFAULT_AUTHOR_COLUMN = "updated_by"
const DEFAULT_TABLE_SCHEMA = "public"

type UpdatedAtTriggerOptions = {
  /** Column the trigger maintains. Default `"updated_at"`. */
  column?: string
  /** Schema holding the table. Default `"public"`, or the table's own. */
  schema?: string
  /** Trigger name. Default `handle_<column>`. */
  name?: string
  /** Schema `moddatetime` is installed into. Default `"extensions"`. */
  extensionSchema?: string
  /** Emit `create extension if not exists`. Default `true`. */
  createExtension?: boolean
}

const quote = (identifier: string) => `"${identifier.split('"').join('""')}"`

function resolveTable(table: PgTable | string, schema?: string) {
  const name = is(table, PgTable) ? getTableName(table) : table
  const tableSchema =
    schema ??
    (is(table, PgTable)
      ? (getTableConfig(table).schema ?? DEFAULT_TABLE_SCHEMA)
      : DEFAULT_TABLE_SCHEMA)

  return { qualified: `${quote(tableSchema)}.${quote(name)}` }
}

/**
 * `CREATE TRIGGER` SQL that keeps `updated_at` current for **every** writer,
 * including PostgREST, the dashboard and psql.
 *
 * `timestamps()` gives the column a `DEFAULT now()`, which covers the insert.
 * SQL has no "on update" default, so without this trigger the column is only
 * ever the insert time. Required, not optional.
 *
 * ```ts
 * // pnpm db:generate --custom --name=posts_audit_triggers
 * // then paste the output into the generated migration:
 * console.log(updatedAtTrigger(posts))
 * ```
 */
export function updatedAtTrigger(
  table: PgTable | string,
  {
    column = DEFAULT_COLUMN,
    createExtension = true,
    extensionSchema = DEFAULT_EXTENSION_SCHEMA,
    name,
    schema,
  }: UpdatedAtTriggerOptions = {}
) {
  const { qualified } = resolveTable(table, schema)
  const triggerName = name ?? `handle_${column}`

  // `moddatetime` takes the column name as a trigger argument and sets it to
  // now() on the NEW row, so it wins over whatever the UPDATE supplied.
  const trigger = [
    `drop trigger if exists ${quote(triggerName)} on ${qualified};`,
    `create trigger ${quote(triggerName)}`,
    `  before update on ${qualified}`,
    "  for each row",
    `  execute function ${quote(extensionSchema)}.moddatetime (${quote(column)});`,
  ].join("\n")

  return createExtension
    ? `${moddatetimeExtension(extensionSchema)}\n\n${trigger}`
    : trigger
}

/** `create extension if not exists moddatetime`, safe to repeat per migration. */
export function moddatetimeExtension(schema = DEFAULT_EXTENSION_SCHEMA) {
  return `create extension if not exists moddatetime with schema ${quote(schema)};`
}

type UpdatedByTriggerOptions = {
  /** Column the trigger maintains. Default `"updated_by"`. */
  column?: string
  /** Schema holding the table. Default `"public"`, or the table's own. */
  schema?: string
  /** Trigger name. Default `handle_<column>`. */
  name?: string
  /** Schema the helper function is created in. Default `"public"`. */
  functionSchema?: string
  /** Emit `create or replace function`. Default `true`. */
  createFunction?: boolean
}

/**
 * `CREATE TRIGGER` SQL that stamps an author column with `auth.uid()` on every
 * update, the `updated_at` story for `updated_by`.
 *
 * `updatedBy()` gives the column a `DEFAULT (select auth.uid())`, which covers
 * the insert. This covers the update, for every writer rather than only the
 * ones going through Drizzle.
 *
 * A write with no session (the admin or `service_role` clients) records `NULL`,
 * because that is what `auth.uid()` returns there.
 */
export function updatedByTrigger(
  table: PgTable | string,
  {
    column = DEFAULT_AUTHOR_COLUMN,
    createFunction = true,
    functionSchema = DEFAULT_TABLE_SCHEMA,
    name,
    schema,
  }: UpdatedByTriggerOptions = {}
) {
  const { qualified } = resolveTable(table, schema)
  const triggerName = name ?? `handle_${column}`
  const functionName = `set_${column}`
  const qualifiedFunction = `${quote(functionSchema)}.${quote(functionName)}`

  // One function serves every table using this column name. `security invoker`
  // is deliberate: auth.uid() reads a transaction-local setting, so the trigger
  // needs no privileges of its own.
  const routine = [
    `create or replace function ${qualifiedFunction}()`,
    "  returns trigger",
    "  language plpgsql",
    "  security invoker",
    `  set search_path = ''`,
    "as $$",
    "begin",
    `  new.${quote(column)} = (select auth.uid());`,
    "  return new;",
    "end;",
    "$$;",
  ].join("\n")

  const trigger = [
    `drop trigger if exists ${quote(triggerName)} on ${qualified};`,
    `create trigger ${quote(triggerName)}`,
    `  before update on ${qualified}`,
    "  for each row",
    `  execute function ${qualifiedFunction}();`,
  ].join("\n")

  return createFunction ? `${routine}\n\n${trigger}` : trigger
}

/**
 * Both update triggers `auditColumns()` needs, in one string.
 *
 * `auditColumns()` and `timestamps()` leave `updated_at` and `updated_by` at
 * their insert values without these, so a table using either helper wants this
 * in a `drizzle-kit generate --custom` migration.
 */
export function auditTriggers(
  table: PgTable | string,
  options: UpdatedAtTriggerOptions & UpdatedByTriggerOptions = {}
) {
  return `${updatedAtTrigger(table, options)}\n\n${updatedByTrigger(table, options)}`
}
