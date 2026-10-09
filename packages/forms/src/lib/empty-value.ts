import type { AnyFieldApi } from "@tanstack/react-form"

import { toFieldName } from "./action-result"
import { extractZodDefaultAt } from "./schema-defaults"
import { type StandardSchemaLike, validateSync } from "./schema-required"
import { getFormSchema } from "./validation-modes"

// A field's empty value is the first one its schema accepts of `null`,
// `undefined` and the type's own empty value (`""` for a string, `[]` for an
// array, through `extractZodDefaults`). So `.nullable()` empties to `null`,
// `.optional()` to `undefined`, and a bare `z.string()` to `""`. A field that
// accepts none of them is required. A cleared field holds its empty value,
// and so does an untouched one whose schema rejects `""` or `[]`.

const NAME_SEGMENT = /[^.[\]]+/g
const INDEX = /^\d+$/

// `members[2].name` (or `members.2.name`) → `["members", 2, "name"]`.
function toPathKeys(name: string): PropertyKey[] {
  return (name.match(NAME_SEGMENT) ?? []).map((part) =>
    INDEX.test(part) ? Number(part) : part
  )
}

function valueAt(root: unknown, keys: readonly PropertyKey[]): unknown {
  let node = root
  for (const key of keys) {
    if (typeof node !== "object" || node === null) {
      return
    }
    node = (node as Record<PropertyKey, unknown>)[key]
  }
  return node
}

// A copy of `root` with `value` at `keys`, copying only the nodes on the way.
function withValueAt(
  root: unknown,
  keys: readonly PropertyKey[],
  value: unknown
): unknown {
  const [key, ...rest] = keys
  if (key === undefined) {
    return value
  }
  const node = (root ?? (typeof key === "number" ? [] : {})) as Record<
    PropertyKey,
    unknown
  >
  const copy = (Array.isArray(node) ? [...node] : { ...node }) as Record<
    PropertyKey,
    unknown
  >
  copy[key] = withValueAt(node[key], rest, value)
  return copy
}

function emptyValueFor(
  schema: StandardSchemaLike | undefined,
  values: unknown,
  name: string,
  fallback: unknown
): unknown {
  if (!schema) {
    return fallback
  }
  const keys = toPathKeys(name)
  const fieldName = toFieldName(keys)
  const typeEmpty = extractZodDefaultAt(
    schema as Parameters<typeof extractZodDefaultAt>[0],
    keys
  )
  const candidates = typeEmpty.ok
    ? [null, undefined, typeEmpty.value]
    : [null, undefined]
  for (const candidate of candidates) {
    const issues = validateSync(schema, withValueAt(values, keys, candidate))
    if (!issues) {
      return fallback
    }
    if (!issues.some((issue) => toFieldName(issue.path) === fieldName)) {
      return candidate
    }
  }
  return fallback
}

function isTypeEmpty(value: unknown): boolean {
  return value === "" || (Array.isArray(value) && value.length === 0)
}

// `extractZodDefaults` starts every string at `""` and every array at `[]`.
// Where the schema rejects that (`z.uuid().nullable()`,
// `z.email().optional()`), start the field at its empty value instead, so an
// untouched optional field passes. A required one keeps `""` or `[]`.
function withEmptyStartValues(
  schema: StandardSchemaLike,
  defaults: Record<string, unknown>
): Record<string, unknown> {
  const issues = validateSync(schema, defaults)
  let result: unknown = defaults
  for (const issue of issues ?? []) {
    const name = toFieldName(issue.path)
    const keys = toPathKeys(name)
    const start = valueAt(defaults, keys)
    if (keys.length === 0 || !isTypeEmpty(start)) {
      continue
    }
    const empty = emptyValueFor(schema, result, name, start)
    if (empty !== start) {
      result = withValueAt(result, keys, empty)
    }
  }
  return result as Record<string, unknown>
}

/**
 * The value `field` takes when the user clears it, by the rule above. Typed as
 * the field's value, since the same schema decides both.
 */
function getEmptyValue<T>(field: AnyFieldApi, fallback: T): T {
  return emptyValueFor(
    getFormSchema(field.form),
    field.form.state.values,
    field.name,
    fallback
  ) as T
}

export { emptyValueFor, getEmptyValue, withEmptyStartValues }
