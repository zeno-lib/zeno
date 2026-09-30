"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import type { ReactNode } from "react"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"
import { RequiredIndicator } from "../lib/required-indicator"

type CheckboxGroupOption<V> = {
  value: V
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

type CheckboxGroupFieldProps<V = string> = {
  /**
   * The options. Pass plain strings or numbers (value === label), or
   * `{ value, label, description?, disabled? }` objects. The form value is the
   * array of checked values, in the order of `items`.
   */
  items: readonly (CheckboxGroupOption<V> | V)[]
  description?: ReactNode
  label?: ReactNode
  /** Stack the options (`"vertical"`, default) or wrap them in a row. */
  orientation?: "horizontal" | "vertical"
  disabled?: boolean
  className?: string
  /** Force the required `*` indicator on or off. Defaults to schema-derived. */
  required?: boolean
}

function toOption<V>(item: CheckboxGroupOption<V> | V): CheckboxGroupOption<V> {
  if (typeof item === "object" && item !== null && "value" in item) {
    return item as CheckboxGroupOption<V>
  }
  return { label: String(item), value: item as V }
}

/** A set of checkboxes bound to one array value (`[]` when none checked). */
function CheckboxGroupField<V = string>({
  className,
  description,
  disabled,
  items,
  label,
  orientation = "vertical",
  required,
}: CheckboxGroupFieldProps<V>) {
  const field = useFieldContext<V[] | null | undefined>()
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  const options = items.map(toOption)
  const checked = field.state.value ?? []

  const toggle = (value: V, on: boolean) => {
    const next = new Set(checked)
    if (on) {
      next.add(value)
    } else {
      next.delete(value)
    }
    // Keep the stored order stable: the order of `items`, not click order.
    field.handleChange(
      options.map((option) => option.value).filter((v) => next.has(v))
    )
  }

  return (
    <FieldSet
      aria-describedby={describedBy(
        [description, descriptionId],
        [showError, errorId]
      )}
      aria-invalid={isInvalid || undefined}
      className={className}
      data-field={field.name}
      data-invalid={isInvalid}
      disabled={disabled}
    >
      {label && (
        <FieldLegend variant="label">
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLegend>
      )}
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      <FieldGroup
        className={cn(
          orientation === "horizontal" && "flex-row flex-wrap gap-x-6 *:w-auto"
        )}
        data-slot="checkbox-group"
      >
        {options.map((option, index) => {
          const id = `${field.name}-${index}`
          return (
            <Field
              data-invalid={isInvalid}
              key={String(option.value)}
              orientation="horizontal"
            >
              <Checkbox
                aria-invalid={isInvalid || undefined}
                checked={checked.includes(option.value)}
                disabled={disabled || option.disabled}
                id={id}
                name={field.name}
                onBlur={field.handleBlur}
                onCheckedChange={(on) => toggle(option.value, on === true)}
                value={String(option.value)}
              />
              {option.description ? (
                <FieldContent>
                  <FieldLabel className="font-normal" htmlFor={id}>
                    {option.label}
                  </FieldLabel>
                  <FieldDescription>{option.description}</FieldDescription>
                </FieldContent>
              ) : (
                <FieldLabel className="w-auto font-normal" htmlFor={id}>
                  {option.label}
                </FieldLabel>
              )}
            </Field>
          )
        })}
      </FieldGroup>
      {showError && (
        <FieldError errors={field.state.meta.errors} id={errorId} />
      )}
    </FieldSet>
  )
}

export type { CheckboxGroupFieldProps, CheckboxGroupOption }
export { CheckboxGroupField }
