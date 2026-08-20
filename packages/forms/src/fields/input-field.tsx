"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import { Children, type ComponentProps, type ReactNode } from "react"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { InputGroup, InputGroupInput } from "@/components/ui/input-group"
import { RequiredIndicator } from "../lib/required-indicator"

type InputFieldProps = Omit<
  ComponentProps<typeof Input>,
  "children" | "id" | "name" | "onBlur"
> & {
  children?: ReactNode
  description?: ReactNode
  label?: ReactNode
  /**
   * Force the required `*` indicator on or off for this field. When omitted,
   * the value is derived from the form's schema.
   */
  required?: boolean
}

function InputField({
  children,
  description,
  label,
  required,
  ...props
}: InputFieldProps) {
  const field = useFieldContext<string>()
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const hasAddons = Children.count(children) > 0
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  const inputProps = {
    "aria-describedby": describedBy(
      [description, descriptionId],
      [showError, errorId]
    ),
    "aria-invalid": isInvalid || undefined,
    id: field.name,
    name: field.name,
    onBlur: field.handleBlur,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      field.handleChange(event.target.value),
    value: field.state.value ?? "",
    ...props,
  }

  return (
    <Field data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={field.name}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      {hasAddons ? (
        <InputGroup>
          <InputGroupInput {...inputProps} />
          {children}
        </InputGroup>
      ) : (
        <Input {...inputProps} />
      )}
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {showError && (
        <FieldError errors={field.state.meta.errors} id={errorId} />
      )}
    </Field>
  )
}

export type { InputFieldProps }
export { InputField }
