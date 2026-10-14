"use client"

import type { FieldControl } from "@zeno-lib/forms/lib/use-field-control"
import type { ReactNode } from "react"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { RequiredIndicator } from "../lib/required-indicator"

type FieldShellProps = Pick<
  FieldControl,
  | "descriptionId"
  | "errorId"
  | "errors"
  | "id"
  | "isInvalid"
  | "labelId"
  | "name"
  | "showRequiredIndicator"
> & {
  /** The control, bound with `useFieldControl`'s `controlProps`. */
  children: ReactNode
  description?: ReactNode
  label?: ReactNode
}

/**
 * The field layout every kit field shares: the label with its `*`, the
 * control, the description and the error, tied together by the ids
 * `useFieldControl` returns. Spread the rest of its result here:
 *
 * ```tsx
 * const { controlProps, ...shell } = useFieldControl({ description, label })
 * <FieldShell {...shell} description={description} label={label}>
 *   <MyControl {...controlProps} />
 * </FieldShell>
 * ```
 */
function FieldShell({
  children,
  description,
  descriptionId,
  errorId,
  errors,
  id,
  isInvalid,
  label,
  labelId,
  name,
  showRequiredIndicator,
}: FieldShellProps) {
  return (
    <Field data-field={name} data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={id} id={labelId}>
          {label}
          {showRequiredIndicator && <RequiredIndicator />}
        </FieldLabel>
      )}
      {children}
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {errors.length > 0 && <FieldError errors={errors} id={errorId} />}
    </Field>
  )
}

export type { FieldShellProps }
export { FieldShell }
