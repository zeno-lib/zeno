"use client"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@zeno-lib/ui/field"
import { cn } from "@zeno-lib/ui/lib/utils"
import { RadioGroup, RadioGroupItem } from "@zeno-lib/ui/radio-group"
import { type ComponentProps, type ReactNode, useId } from "react"

import { describedBy } from "../lib/aria"
import { useFieldContext } from "../lib/contexts"
import { RequiredIndicator } from "../lib/required-indicator"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "../lib/use-is-invalid"

type RadioGroupFieldProps = Omit<
  ComponentProps<typeof RadioGroup>,
  "name" | "onValueChange" | "value"
> & {
  description?: ReactNode
  label?: ReactNode
  /** Force the required `*` indicator on or off. Defaults to schema-derived. */
  required?: boolean
}

function RadioGroupField({
  children,
  description,
  label,
  required,
  ...props
}: RadioGroupFieldProps) {
  const field = useFieldContext<string>()
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  return (
    <Field data-invalid={isInvalid}>
      {label && (
        <FieldLabel>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <RadioGroup
        aria-describedby={describedBy(
          [description, descriptionId],
          [showError, errorId]
        )}
        aria-invalid={isInvalid || undefined}
        name={field.name}
        onValueChange={(value) => field.handleChange(String(value))}
        value={field.state.value ?? ""}
        {...props}
      >
        {children}
      </RadioGroup>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {showError && (
        <FieldError errors={field.state.meta.errors} id={errorId} />
      )}
    </Field>
  )
}

type RadioGroupFieldItemProps = Omit<
  ComponentProps<typeof RadioGroupItem>,
  "id"
> & {
  children?: ReactNode
  labelClassName?: string
}

function RadioGroupFieldItem({
  children,
  className,
  labelClassName,
  ...props
}: RadioGroupFieldItemProps) {
  const id = useId()
  return (
    <label
      className={cn("flex items-center gap-2 text-sm", labelClassName)}
      htmlFor={id}
    >
      <RadioGroupItem className={className} id={id} {...props} />
      {children}
    </label>
  )
}

export { RadioGroupField, RadioGroupFieldItem }
