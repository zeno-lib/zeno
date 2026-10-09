"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsFieldRequiredBySchema,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import type { ComponentProps, ReactNode } from "react"
import { Children, isValidElement, useId, useMemo, useRef } from "react"
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
  /**
   * Mark the field required, or not, over the schema. Drives the `*` and
   * `aria-required`.
   */
  required?: boolean
  triggerClassName?: string
  triggerSize?: ComponentProps<typeof SelectTrigger>["size"]
}

function SelectField({
  children,
  description,
  label,
  onOpenChange,
  placeholder,
  required,
  triggerClassName,
  triggerSize,
  ...props
}: SelectFieldProps) {
  const field = useFieldContext()
  // Opening the popup moves focus into it, so the trigger's blur would mark
  // the field touched, and show a required error, before anything is picked.
  // The field is touched once the popup closes, or focus leaves it closed.
  const isOpen = useRef<boolean>(false)
  const id = useId()
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired
  const schemaRequiresValue = useIsFieldRequiredBySchema(field)
  const requiresValue = required ?? schemaRequiresValue

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
    <Field data-field={field.name} data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={id}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <Select
        items={items}
        name={field.name}
        onOpenChange={(open, eventDetails) => {
          isOpen.current = open
          if (!open) {
            field.handleBlur()
          }
          onOpenChange?.(open, eventDetails)
        }}
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
          aria-required={requiresValue || undefined}
          className={triggerClassName}
          id={id}
          onBlur={() => {
            if (!isOpen.current) {
              field.handleBlur()
            }
          }}
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
