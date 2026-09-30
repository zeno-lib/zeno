"use client"

import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { useFormattedNumber } from "@zeno-lib/forms/lib/use-formatted-number"
import { type ReactNode, useMemo } from "react"
import { InputGroupAddon, InputGroupText } from "@/components/ui/input-group"
import { InputField, type InputFieldProps } from "./input-field"

type MoneyFieldProps = Omit<
  InputFieldProps,
  "defaultValue" | "inputMode" | "onChange" | "onPaste" | "type" | "value"
> & {
  /** ISO 4217 code shown as an add-on, e.g. `"CHF"`, `"EUR"`, `"USD"`. */
  currency?: string
  /** How the currency add-on reads. Defaults to `"symbol"`. */
  currencyDisplay?: "code" | "name" | "narrowSymbol" | "symbol"
  /**
   * Which side the currency add-on sits on. Defaults to the locale's own
   * convention (`CHF 1’234` in `de-CH`, `1.234 €` in `de-DE`).
   */
  currencyPosition?: "end" | "start"
  /**
   * BCP 47 locale driving the group/decimal separators (`de-CH` →
   * `1’234.50`). Defaults to the runtime locale.
   */
  locale?: string
  /**
   * Digits allowed after the decimal separator. Defaults to the currency's
   * minor units (2 for CHF, 0 for JPY), or 2 without a currency.
   */
  fractionDigits?: number
  /** Accept negative amounts. Defaults to `false`. */
  allowNegative?: boolean
  /** Clamp the amount on blur. */
  min?: number
  /** Clamp the amount on blur. */
  max?: number
}

type CurrencyParts = {
  label: string
  position: "end" | "start"
  fractionDigits: number
}

function getCurrencyParts(
  locale: string | undefined,
  currency: string,
  currencyDisplay: NonNullable<MoneyFieldProps["currencyDisplay"]>
): CurrencyParts {
  const format = new Intl.NumberFormat(locale, {
    currency,
    currencyDisplay,
    style: "currency",
  })
  const parts = format.formatToParts(1)
  const currencyIndex = parts.findIndex((part) => part.type === "currency")
  const integerIndex = parts.findIndex((part) => part.type === "integer")
  return {
    fractionDigits: format.resolvedOptions().maximumFractionDigits ?? 2,
    label: parts[currencyIndex]?.value ?? currency,
    position: currencyIndex > integerIndex ? "end" : "start",
  }
}

/**
 * Amount input with locale-aware thousands separators and a currency add-on.
 * The form value is `number | null` (empty input → `null`).
 */
function MoneyField({
  allowNegative = false,
  children,
  currency,
  currencyDisplay = "symbol",
  currencyPosition,
  fractionDigits,
  locale,
  max,
  min,
  ...props
}: MoneyFieldProps) {
  const field = useFieldContext<number | null | undefined>()
  const parts = useMemo(
    () =>
      currency ? getCurrencyParts(locale, currency, currencyDisplay) : null,
    [currency, currencyDisplay, locale]
  )
  const digits = fractionDigits ?? parts?.fractionDigits ?? 2
  const position = currencyPosition ?? parts?.position ?? "end"

  const inputProps = useFormattedNumber({
    allowNegative,
    locale,
    max,
    maximumFractionDigits: digits,
    min,
    onBlur: field.handleBlur,
    onValueChange: (next) => field.handleChange(next),
    padFraction: true,
    value: field.state.value,
  })

  let addon: ReactNode = null
  if (parts) {
    addon = (
      <InputGroupAddon
        align={position === "start" ? "inline-start" : "inline-end"}
      >
        <InputGroupText>{parts.label}</InputGroupText>
      </InputGroupAddon>
    )
  }

  return (
    <InputField {...props} {...inputProps}>
      {addon}
      {children}
    </InputField>
  )
}

export type { MoneyFieldProps }
export { MoneyField }
