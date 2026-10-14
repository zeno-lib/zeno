"use client"

import type { AnyFieldMeta } from "@tanstack/react-form"
import { type ReactNode, useId } from "react"

import { describedBy } from "./aria"
import { useFieldContext } from "./contexts"
import { getEmptyValue } from "./empty-value"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsFieldRequiredBySchema,
  useIsInvalid,
} from "./use-is-invalid"

type UseFieldControlOptions = {
  /**
   * The description the field renders, if any. The control is described by
   * it, and by the error while one shows.
   */
  description?: ReactNode
  disabled?: boolean
  /**
   * The label the field renders, if any. The control gets `aria-labelledby`,
   * which names a control a `<label htmlFor>` can't, such as a
   * `role="radiogroup"`.
   */
  label?: ReactNode
  /**
   * Mark the field required, or not, over the schema. Drives the `*` and
   * `aria-required`.
   */
  required?: boolean
}

/** The props that bind a control to its field. Spread them on the control. */
type FieldControlProps<TValue = unknown> = {
  "aria-describedby": string | undefined
  "aria-invalid": true | undefined
  "aria-labelledby": string | undefined
  "aria-required": true | undefined
  disabled: boolean | undefined
  id: string
  name: string
  /** Marks the field touched. */
  onBlur: () => void
  /**
   * Stores `value`. An empty one (`null`, `undefined`, `""` or `[]`) stores
   * the field's empty value instead, which its schema picks.
   */
  onChange: (value: TValue) => void
  value: TValue
}

type FieldControl<TValue = unknown> = {
  controlProps: FieldControlProps<TValue>
  descriptionId: string
  errorId: string
  /**
   * The errors to render: none while the field's errors are hidden, by the
   * form's validation mode or `hideFieldErrors`.
   */
  errors: AnyFieldMeta["errors"]
  /** The control's id, for the label's `htmlFor`. */
  id: string
  isInvalid: boolean
  /** The field requires a value, by the schema or `required`. */
  isRequired: boolean
  /** The label's id, when `label` is passed. */
  labelId: string | undefined
  name: string
  /** Show the `*`: as `isRequired`, but off under `requiredIndicator: false`. */
  showRequiredIndicator: boolean
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

/**
 * Everything a control needs to act as a field of the form, inside a field
 * component the form renders (`form.AppField`, or one registered with
 * `createZenoForm`): the props to spread on the control, and the ids and
 * state its label, description and error need.
 */
function useFieldControl<TValue = unknown>({
  description,
  disabled,
  label,
  required,
}: UseFieldControlOptions = {}): FieldControl<TValue> {
  const field = useFieldContext<TValue>()
  const id = useId()
  const labelId = label ? `${id}-label` : undefined
  const descriptionId = `${id}-description`
  const errorId = `${id}-error`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const schemaRequiresValue = useIsFieldRequiredBySchema(field)
  const isRequired = required ?? schemaRequiresValue

  return {
    controlProps: {
      "aria-describedby": describedBy(
        [description, descriptionId],
        [showError, errorId]
      ),
      "aria-invalid": isInvalid || undefined,
      "aria-labelledby": labelId,
      "aria-required": isRequired || undefined,
      disabled,
      id,
      name: field.name,
      onBlur: field.handleBlur,
      onChange: (value) =>
        field.handleChange(
          isEmpty(value) ? getEmptyValue(field, value) : value
        ),
      value: field.state.value,
    },
    descriptionId,
    errorId,
    errors: showError ? field.state.meta.errors : [],
    id,
    isInvalid,
    isRequired,
    labelId,
    name: field.name,
    showRequiredIndicator: required ?? schemaRequired,
  }
}

export type { FieldControl, FieldControlProps, UseFieldControlOptions }
export { useFieldControl }
