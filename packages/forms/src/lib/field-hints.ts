import type { AnyFieldApi } from "@tanstack/react-form"
import { toPathKeys } from "./empty-value"
import { extractZodMetaAt } from "./schema-defaults"
import { getFormSchema } from "./validation-modes"

/**
 * What a field reads from its schema's `.meta({ field, … })` when `field`
 * names it. The `percentage()` and `year()` columns of `@zeno-lib/db/schema`
 * put their scale and bounds there, so `PercentageField` and `YearField` show
 * and clamp what the column accepts with no props. A prop the field is given
 * wins.
 */
type FieldHints = {
  readonly max?: number | undefined
  readonly min?: number | undefined
  readonly scale?: "fraction" | "percent" | undefined
}

const toNumber = (value: unknown) =>
  typeof value === "number" ? value : undefined

function getFieldHints(field: AnyFieldApi, kind: string): FieldHints {
  const schema = getFormSchema(field.form)
  const meta = schema
    ? extractZodMetaAt(
        schema as Parameters<typeof extractZodMetaAt>[0],
        toPathKeys(field.name)
      )
    : undefined
  if (meta?.field !== kind) {
    return {}
  }
  return {
    max: toNumber(meta.max),
    min: toNumber(meta.min),
    scale:
      meta.scale === "fraction" || meta.scale === "percent"
        ? meta.scale
        : undefined,
  }
}

export type { FieldHints }
export { getFieldHints }
