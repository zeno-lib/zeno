"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import type { ComponentProps, ReactNode } from "react"
import { Children, isValidElement, useMemo } from "react"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RequiredIndicator } from "../lib/required-indicator"

type SelectFieldProps = Omit<
  ComponentProps<typeof Select>,
  "name" | "onValueChange" | "value" | "items"
> & {
  children: ReactNode
  description?: ReactNode
  label?: ReactNode
  placeholder?: string
  /** Force the required `*` indicator on or off. Defaults to schema-derived. */
  required?: boolean
  triggerClassName?: string
  triggerSize?: ComponentProps<typeof SelectTrigger>["size"]
}

function SelectField({
  children,
  description,
  label,
  placeholder,
  required,
  triggerClassName,
  triggerSize,
  ...props
}: SelectFieldProps) {
  const field = useFieldContext()
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  const items = useMemo(() => {
    const map: Record<string, ReactNode> = {}
    Children.forEach(children, (child) => {
      if (isValidElement(child)) {
        const p = child.props as { value?: unknown; children?: ReactNode }
        if (p.value !== undefined) {
          map[String(p.value)] = p.children
        }
      }
    })
    return map
  }, [children])

  return (
    <Field data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={field.name}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <Select
        items={items}
        name={field.name}
        onValueChange={(value) => field.handleChange(value)}
        value={field.state.value ?? null}
        {...props}
      >
        <SelectTrigger
          aria-describedby={describedBy(
            [description, descriptionId],
            [showError, errorId]
          )}
          aria-invalid={isInvalid || undefined}
          className={triggerClassName}
          id={field.name}
          onBlur={field.handleBlur}
          size={triggerSize}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {showError && (
        <FieldError errors={field.state.meta.errors} id={errorId} />
      )}
    </Field>
  )
}

export { SelectField }
