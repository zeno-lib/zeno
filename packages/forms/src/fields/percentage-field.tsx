"use client"

import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { getEmptyValue } from "@zeno-lib/forms/lib/empty-value"
import { getFieldHints } from "@zeno-lib/forms/lib/field-hints"
import { useFormattedNumber } from "@zeno-lib/forms/lib/use-formatted-number"
import { InputGroupAddon, InputGroupText } from "@/components/ui/input-group"
import { InputField, type InputFieldProps } from "./input-field"

type PercentageFieldProps = Omit<
  InputFieldProps,
  "defaultValue" | "inputMode" | "onChange" | "onPaste" | "type" | "value"
> & {
  /**
   * How the form value relates to what the user types:
   * - `"percent"` (default): the value is the number shown, `12.5` ↔ `12.5 %`.
   * - `"fraction"`: the value is a ratio, `0.125` ↔ `12.5 %`.
   *
   * A `percentage()` column of `@zeno-lib/db/schema` sets it, as it sets
   * `min` and `max`.
   */
  scale?: "fraction" | "percent"
  /** BCP 47 locale driving the decimal separator. Defaults to the runtime locale. */
  locale?: string
  /** Digits allowed after the decimal separator (of the shown percentage). Defaults to `2`. */
  fractionDigits?: number
  /** Accept negative percentages. Defaults to whether `min` is below 0. */
  allowNegative?: boolean
  /** Clamp on blur, in the form value's scale. */
  min?: number
  /** Clamp on blur, in the form value's scale. */
  max?: number
}

const toPercent = (value: number) => value * 100
const fromPercent = (value: number) => value / 100

/**
 * Percentage input with a `%` add-on. The form value is `number | null`, on
 * the `scale` you pick, or the one the schema's `percentage()` column hints
 * (`0–100` by default, `0–1` with `scale="fraction"`).
 */
function PercentageField({
  allowNegative,
  children,
  fractionDigits = 2,
  locale,
  max: maxProp,
  min: minProp,
  scale: scaleProp,
  ...props
}: PercentageFieldProps) {
  const field = useFieldContext<number | null | undefined>()
  const hints = getFieldHints(field, "percentage")
  const max = maxProp ?? hints.max
  const min = minProp ?? hints.min
  const isFraction = (scaleProp ?? hints.scale ?? "percent") === "fraction"

  const inputProps = useFormattedNumber({
    allowNegative: allowNegative ?? (min !== undefined && min < 0),
    locale,
    max,
    maximumFractionDigits: fractionDigits,
    min,
    onBlur: field.handleBlur,
    onValueChange: (next) =>
      field.handleChange(next ?? getEmptyValue(field, null)),
    value: field.state.value,
    ...(isFraction ? { fromDisplay: fromPercent, toDisplay: toPercent } : {}),
  })

  return (
    <InputField {...props} {...inputProps}>
      <InputGroupAddon align="inline-end">
        <InputGroupText>%</InputGroupText>
      </InputGroupAddon>
      {children}
    </InputField>
  )
}

export type { PercentageFieldProps }
export { PercentageField }
