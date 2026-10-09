"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import { type ComponentProps, type ReactNode, useId } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { RequiredIndicator } from "../lib/required-indicator"

type CheckboxFieldProps = Omit<
  ComponentProps<typeof Checkbox>,
  "checked" | "id" | "name" | "onBlur" | "onCheckedChange"
> & {
  description?: ReactNode
  label?: ReactNode
  /** Force the required `*` indicator on or off. Defaults to schema-derived. */
  required?: boolean
}

function CheckboxField({
  description,
  label,
  required,
  ...props
}: CheckboxFieldProps) {
  const field = useFieldContext<boolean>()
  const id = useId()
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  return (
    <Field
      data-field={field.name}
      data-invalid={isInvalid}
      orientation="horizontal"
    >
      <Checkbox
        aria-describedby={describedBy(
          [description, descriptionId],
          [showError, errorId]
        )}
        aria-invalid={isInvalid || undefined}
        checked={field.state.value ?? false}
        id={id}
        name={field.name}
        onBlur={field.handleBlur}
        onCheckedChange={(value) => field.handleChange(value === true)}
        {...props}
      />
      <FieldContent>
        {label && (
          <FieldLabel className="font-normal" htmlFor={id}>
            {label}
            {isRequired && <RequiredIndicator />}
          </FieldLabel>
        )}
        {description && (
          <FieldDescription id={descriptionId}>{description}</FieldDescription>
        )}
        {showError && (
          <FieldError errors={field.state.meta.errors} id={errorId} />
        )}
      </FieldContent>
    </Field>
  )
}

export { CheckboxField }
