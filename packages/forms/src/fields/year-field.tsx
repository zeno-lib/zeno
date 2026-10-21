"use client"

import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { getEmptyValue } from "@zeno-lib/forms/lib/empty-value"
import { getFieldHints } from "@zeno-lib/forms/lib/field-hints"
import { useFormattedNumber } from "@zeno-lib/forms/lib/use-formatted-number"
import { InputField, type InputFieldProps } from "./input-field"

type YearFieldProps = Omit<
  InputFieldProps,
  | "defaultValue"
  | "inputMode"
  | "max"
  | "maxLength"
  | "min"
  | "onChange"
  | "onPaste"
  | "type"
  | "value"
> & {
  /** Earliest accepted year. The value is clamped to it on blur. */
  min?: number
  /** Latest accepted year. The value is clamped to it on blur. */
  max?: number
}

/**
 * Four-digit year input. The form value is an integer year or `null`. No
 * thousands separator, digits only, clamped on blur to `min`/`max`, or to the
 * bounds the schema's `year()` column hints.
 */
function YearField({ max: maxProp, min: minProp, ...props }: YearFieldProps) {
  const field = useFieldContext<number | null | undefined>()
  const hints = getFieldHints(field, "year")
  const max = maxProp ?? hints.max
  const min = minProp ?? hints.min

  const inputProps = useFormattedNumber({
    allowNegative: false,
    max,
    maxIntegerDigits: 4,
    maximumFractionDigits: 0,
    min,
    onBlur: field.handleBlur,
    onValueChange: (next) =>
      field.handleChange(next ?? getEmptyValue(field, null)),
    useGrouping: false,
    value: field.state.value,
  })

  return (
    <InputField
      autoComplete="off"
      maxLength={4}
      placeholder="YYYY"
      {...props}
      {...inputProps}
    />
  )
}

export type { YearFieldProps }
export { YearField }
