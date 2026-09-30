"use client"

import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
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
   */
  scale?: "fraction" | "percent"
  /** BCP 47 locale driving the decimal separator. Defaults to the runtime locale. */
  locale?: string
  /** Digits allowed after the decimal separator (of the shown percentage). Defaults to `2`. */
  fractionDigits?: number
  /** Accept negative percentages. Defaults to `false`. */
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
 * the `scale` you pick (`0–100` by default, `0–1` with `scale="fraction"`).
 */
function PercentageField({
  allowNegative = false,
  children,
  fractionDigits = 2,
  locale,
  max,
  min,
  scale = "percent",
  ...props
}: PercentageFieldProps) {
  const field = useFieldContext<number | null | undefined>()
  const isFraction = scale === "fraction"

  const inputProps = useFormattedNumber({
    allowNegative,
    locale,
    max,
    maximumFractionDigits: fractionDigits,
    min,
    onBlur: field.handleBlur,
    onValueChange: (next) => field.handleChange(next),
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
