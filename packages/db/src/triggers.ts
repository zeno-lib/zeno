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

/**
 * `CREATE TRIGGER` SQL that keeps a timestamp column current for **every**
 * writer, including PostgREST, the dashboard and psql.
 *
 * Drizzle's `$onUpdateFn` only fires for statements Drizzle itself builds, so
 * in a Supabase app it misses most writes. Pair this with
 * `timestamps({ onUpdate: false })` so one mechanism owns the column.
 *
 * ```ts
 * // pnpm db:generate --custom --name=posts_updated_at
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
  const tableName = is(table, PgTable) ? getTableName(table) : table
  const tableSchema =
    schema ??
    (is(table, PgTable)
      ? (getTableConfig(table).schema ?? DEFAULT_TABLE_SCHEMA)
      : DEFAULT_TABLE_SCHEMA)
  const qualified = `${quote(tableSchema)}.${quote(tableName)}`
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
