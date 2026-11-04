import type {
  StandardJSONSchemaV1,
  StandardSchemaV1,
} from "@standard-schema/spec"
import type { ChangeDescription, ChangeValue } from "@zeno-lib/db/next"

/** What every agent tool definition carries, read off the `definition` key. */
interface AgentDefinitionBase<TContext> {
  readonly description: string
  readonly invoke: (input: unknown, context: TContext) => Promise<unknown>
  readonly name: string
  /**
   * The definition's schema. A tool list also needs it to implement Standard
   * JSON Schema (Zod 4.2 or later does), which `@zeno-lib/db` doesn't track in
   * its types, so the list checks it when it is built.
   */
  readonly schema: object
}

/** The `definition` of a `defineQuery({ name, description, schema, run })` export. */
export interface AgentQueryDefinition<TContext>
  extends AgentDefinitionBase<TContext> {
  readonly kind: "query"
  readonly readOnly: true
}

/**
 * The `definition` of a `defineAction` or `defineFormAction` object-form export
 * built **with** a `describeChange`: a write the agent may only run once the
 * user has seen the change.
 */
export interface AgentWriteDefinition<TContext>
  extends AgentDefinitionBase<TContext> {
  readonly describe: (
    input: unknown,
    context: TContext
  ) => Promise<ChangeDescription | null>
  readonly describeChange: (db: never, input: never, context: never) => unknown
  readonly kind: "action" | "formAction"
  readonly readOnly: false
}

export type AgentDefinition<TContext> =
  | AgentQueryDefinition<TContext>
  | AgentWriteDefinition<TContext>

/**
 * An object-form export from `@zeno-lib/db/next`, as a tool list holds it. A
 * positional export has no `definition`, and a write without `describeChange`
 * has no `describeChange` in its type, so neither type-checks as a tool.
 */
export interface AgentTool<
  TContext,
  TDefinition extends AgentDefinition<TContext> = AgentDefinition<TContext>,
> {
  readonly definition: TDefinition
}

/** A read-only agent tool: a `defineQuery` object-form export. */
export type AgentQuery<TContext> = AgentTool<
  TContext,
  AgentQueryDefinition<TContext>
>

/** The schema shape both AI SDK and the MCP SDK take. */
export type ToolSchema = StandardSchemaV1<unknown, unknown> &
  StandardJSONSchemaV1<unknown, unknown>

// A character that can break, reorder or hide text where the approval shows:
// C0 and C1 controls (newline, NEL), DEL, the Unicode line and paragraph
// separators, and the bidirectional marks and overrides.
const isUnsafeCharacter = (code: number) =>
  code < 0x20 ||
  (code >= 0x7f && code <= 0x9f) ||
  code === 0x20_28 ||
  code === 0x20_29 ||
  code === 0x20_0e ||
  code === 0x20_0f ||
  (code >= 0x20_2a && code <= 0x20_2e) ||
  (code >= 0x20_66 && code <= 0x20_69)

const replaceUnsafe = (text: string, replace: (code: number) => string) =>
  Array.from(text, (character) => {
    const code = character.charCodeAt(0)
    return isUnsafeCharacter(code) ? replace(code) : character
  }).join("")

// A name on one line: each unsafe character becomes a space.
const singleLine = (text: string) => replaceUnsafe(text, () => " ")

// A value quoted as JSON, with what JSON leaves raw (U+2028, the bidi marks)
// escaped as well.
const formatValue = (value: ChangeValue) =>
  value === null
    ? "(empty)"
    : replaceUnsafe(
        JSON.stringify(value),
        (code) => `\\u${code.toString(16).padStart(4, "0")}`
      )

/**
 * The approval text for a change: the record on the first line, then one line
 * per field, old → new. Strings are quoted, with every character that could
 * break or reorder a line escaped, so a value read from the database can't add
 * a line that isn't a change.
 *
 * ```text
 * Post 12 (Launch notes)
 * title: "Draft" → "Launch notes"
 * publishedAt: (empty) → "2026-11-04"
 * ```
 */
export function formatChange(change: ChangeDescription): string {
  const entity = singleLine(change.entity).trim()
  if (change.changes.length === 0) {
    return `${entity}\n(no field changes)`
  }
  const lines = change.changes.map(
    ({ field, from, to }) =>
      `${singleLine(field)}: ${formatValue(from)} → ${formatValue(to)}`
  )
  return [entity, ...lines].join("\n")
}

const isFunction = (value: unknown): value is (...args: never[]) => unknown =>
  typeof value === "function"

/**
 * `value` as JSON text for a model. A `bigint` (a Drizzle `bigint` column in
 * `bigint` mode) becomes its decimal string instead of throwing.
 */
export function toJsonText(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    typeof item === "bigint" ? item.toString() : item
  )
}

/**
 * Checks a tool list when it is built: one tool per name, a `describeChange` on
 * every write, and a schema the libraries can describe to a model. With
 * `readOnly`, a write is refused too.
 */
export function checkAgentTools<TContext>(
  tools: readonly AgentTool<TContext>[],
  { readOnly = false }: { readOnly?: boolean } = {}
): void {
  const names = new Set<string>()
  for (const tool of tools) {
    const definition = tool.definition as AgentDefinition<TContext> | undefined
    if (!definition) {
      throw new TypeError(
        "An agent tool must be an object-form export of defineQuery, defineAction or defineFormAction"
      )
    }
    const { name } = definition
    if (names.has(name)) {
      throw new TypeError(`Two agent tools are named "${name}"`)
    }
    names.add(name)
    if (!definition.readOnly) {
      if (readOnly) {
        throw new TypeError(
          `"${name}" writes, and this tool list serves reads only`
        )
      }
      if (!isFunction(definition.describeChange)) {
        throw new TypeError(
          `"${name}" writes, so it needs a describeChange: an approval must show the change`
        )
      }
    }
    toolSchema(definition)
  }
}

/**
 * The definition's schema as AI SDK and the MCP SDK take it, **check-only**:
 * it validates, but hands the libraries back the raw input, not the parsed
 * output. Both libraries pass what `validate` returns to the tool, and the tool
 * is the definition's `invoke` (or `describe`), which parses again. Parsing a
 * parsed value breaks a schema whose output is not valid input, such as a
 * `transform` from string to number.
 *
 * The vendor is not `zod`: AI SDK sends a Zod schema down its own path, which
 * parses with Zod directly and would return the output.
 */
export function toolSchema(
  definition: Pick<AgentDefinitionBase<never>, "name" | "schema">
): ToolSchema {
  const standard = (definition.schema as Partial<ToolSchema>)["~standard"]
  if (
    !(isFunction(standard?.validate) && isFunction(standard.jsonSchema?.input))
  ) {
    throw new TypeError(
      `"${definition.name}" needs a schema that implements Standard Schema and Standard JSON Schema, such as Zod 4.2 or later`
    )
  }
  const { jsonSchema, validate } = standard
  return {
    "~standard": {
      jsonSchema,
      validate: async (value) => {
        const result = await validate(value)
        return result.issues ? result : { value }
      },
      vendor: "zeno-lib",
      version: 1,
    },
  }
}
