"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import { type ComponentProps, type ReactNode, useId } from "react"
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
  const id = useId()
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  const { value } = field.state
  const readout = formatValue && value !== undefined ? formatValue(value) : null
  // Not a truthiness check: a formatter may return the number 0, which must still render.
  const hasReadout = readout !== null && readout !== undefined

  return (
    <Field data-field={field.name} data-invalid={isInvalid}>
      {(label || hasReadout) && (
        <FieldContent className="flex-row items-center justify-between">
          {label && (
            <FieldLabel htmlFor={id}>
              {label}
              {isRequired && <RequiredIndicator />}
            </FieldLabel>
          )}
          {hasReadout && (
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
        id={id}
        name={field.name}
        onBlur={field.handleBlur}
        onValueChange={(next) => {
          const nextValue: SliderValue =
            typeof next === "number" ? next : Array.from(next)
          field.handleChange(nextValue)
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
