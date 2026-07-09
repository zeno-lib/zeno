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
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { cn } from "@/lib/utils"
import { RequiredIndicator } from "../lib/required-indicator"

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
