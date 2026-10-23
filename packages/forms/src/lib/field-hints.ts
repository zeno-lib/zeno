import type { AnyFieldApi } from "@tanstack/react-form"
import { toPathKeys } from "./empty-value"
import { findZodSchemaAt } from "./schema-defaults"
import { getFormSchema } from "./validation-modes"

/**
 * What a field reads from the column its schema comes from, when the column's
 * hint names it. The `percentage()` and `year()` columns of
 * `@zeno-lib/db/schema` give one, so `PercentageField` and `YearField` show
 * and clamp what the column accepts with no props: the scale from the hint,
 * the bounds from the schema's own `.min()` and `.max()`, a caller's
 * narrowing included. A prop the field is given wins.
 */
type FieldHints = {
  readonly max?: number | undefined
  readonly min?: number | undefined
  readonly scale?: "fraction" | "percent" | undefined
}

// The registry `@zeno-lib/schema` puts each column's hint in, under a
// `globalThis` symbol both packages name, so this one reads it without
// importing that one. Absent until `@zeno-lib/schema` loads, and then no
// field has a hint.
const FIELD_HINTS_KEY = Symbol.for("@zeno-lib/field-hints")

type HintRegistry = { readonly get: (schema: object) => unknown }

type Bounded = { readonly maxValue?: unknown; readonly minValue?: unknown }

const readHint = (node: object) => {
  const registry = (globalThis as { [FIELD_HINTS_KEY]?: HintRegistry })[
    FIELD_HINTS_KEY
  ]
  const hint = registry?.get(node) as { field?: unknown } | undefined
  return typeof hint?.field === "string" ? hint : undefined
}

// A schema with no `.min()` or `.max()` reports `null` or an infinity.
const toBound = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined

function getFieldHints(field: AnyFieldApi, kind: string): FieldHints {
  const schema = getFormSchema(field.form)
  const found = schema
    ? findZodSchemaAt(
        schema as Parameters<typeof findZodSchemaAt>[0],
        toPathKeys(field.name),
        readHint
      )
    : undefined
  if (found?.value.field !== kind) {
    return {}
  }
  const { scale } = found.value as { scale?: unknown }
  const { maxValue, minValue } = found.node as Bounded
  return {
    max: toBound(maxValue),
    min: toBound(minValue),
    scale: scale === "fraction" || scale === "percent" ? scale : undefined,
  }
}

export type { FieldHints }
export { getFieldHints }
