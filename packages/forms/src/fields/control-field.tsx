"use client"

import {
  type FieldControlProps,
  useFieldControl,
} from "@zeno-lib/forms/lib/use-field-control"
import type { ReactNode } from "react"
import { FieldShell } from "./field-shell"

type ControlFieldProps<TValue = unknown> = {
  description?: ReactNode
  disabled?: boolean
  label?: ReactNode
  /**
   * Renders the control, given the props that bind it to the field: `id`,
   * `name`, `value`, `onChange(value)`, `onBlur`, `disabled` and the
   * `aria-*`. Spread them on a control that takes its value that way, or map
   * them for one that doesn't. Keep `aria-invalid` on the focusable element
   * (or a group root around it): a failed submit focuses the first invalid
   * field by it.
   */
  render: (control: FieldControlProps<TValue>) => ReactNode
  /**
   * Mark the field required, or not, over the schema. Drives the `*` and
   * `aria-required`.
   */
  required?: boolean
}

/**
 * Binds a controlled component the kit has no field for (a phone input, a
 * star rating, a color picker) in the kit's field layout. Clearing it stores
 * the field's empty value, as the kit's fields do.
 */
function ControlField<TValue = unknown>({
  description,
  disabled,
  label,
  render,
  required,
}: ControlFieldProps<TValue>) {
  const { controlProps, ...shell } = useFieldControl<TValue>({
    description,
    disabled,
    label,
    required,
  })

  return (
    <FieldShell {...shell} description={description} label={label}>
      {render(controlProps)}
    </FieldShell>
  )
}

export type { ControlFieldProps }
export { ControlField }
