"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import type { ComponentProps, ReactNode } from "react"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Slider } from "@/components/ui/slider"
import { RequiredIndicator } from "../lib/required-indicator"

type SliderValue = number | number[]

type SliderFieldProps = Omit<
  ComponentProps<typeof Slider>,
  "name" | "onBlur" | "onValueChange" | "value"
> & {
  description?: ReactNode
  label?: ReactNode
  /**
   * Render a live numeric readout next to the label. Accepts the current
   * value(s) so callers can format units (e.g. `${v}%`, `$${a}-$${b}`).
   */
  formatValue?: (value: SliderValue) => ReactNode
  /** Force the required `*` indicator on or off. Defaults to schema-derived. */
  required?: boolean
}

function SliderField({
  description,
  formatValue,
  label,
  required,
  ...props
}: SliderFieldProps) {
  const field = useFieldContext<SliderValue>()
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  const value = field.state.value
  const readout = formatValue && value !== undefined ? formatValue(value) : null

  return (
    <Field data-invalid={isInvalid}>
      {(label || readout) && (
        <FieldContent className="flex-row items-center justify-between">
          {label && (
            <FieldLabel htmlFor={field.name}>
              {label}
              {isRequired && <RequiredIndicator />}
            </FieldLabel>
          )}
          {readout && (
            <span className="text-muted-foreground text-sm tabular-nums">
              {readout}
            </span>
          )}
        </FieldContent>
      )}
      <Slider
        aria-describedby={describedBy(
          [description, descriptionId],
          [showError, errorId]
        )}
        aria-invalid={isInvalid || undefined}
        id={field.name}
        name={field.name}
        onBlur={field.handleBlur}
        onValueChange={(next) => {
          const value: SliderValue =
            typeof next === "number" ? next : Array.from(next)
          field.handleChange(value)
        }}
        value={value}
        {...props}
      />
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {showError && (
        <FieldError errors={field.state.meta.errors} id={errorId} />
      )}
    </Field>
  )
}

export type { SliderFieldProps }
export { SliderField }
