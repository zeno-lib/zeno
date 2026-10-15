"use client"

import type { AnyFieldMeta } from "@tanstack/react-form"
import { type ReactNode, useCallback, useId } from "react"

import { describedBy } from "./aria"
import { useFieldContext } from "./contexts"
import { emptyValueFor } from "./empty-value"
import { useIsFormDisabled } from "./form-disabled"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsFieldRequiredBySchema,
  useIsInvalid,
} from "./use-is-invalid"
import { getFormSchema } from "./validation-modes"

type UseFieldControlOptions = {
  /**
   * The description the field renders, if any. The control is described by
   * it, and by the error while one shows.
   */
  description?: ReactNode
  /**
   * Disable the control. A disabled form (`useForm({ disabled })`,
   * `<Form disabled>`, `FormDialog`'s `disabled`) disables it either way.
   */
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
  /** The field's own `disabled`, or the form's. */
  disabled: boolean | undefined
  id: string
  name: string
  /** Marks the field touched. */
  onBlur: () => void
  /**
   * Stores `value`, not a change event: a control that reports one maps it
   * (`onChange(event.target.value)`). An empty value (`null`, `undefined`,
   * `""`, `NaN` or `[]`) stores the field's empty value instead, which its
   * schema picks. Stable across renders.
   */
  onChange: (value: TValue) => void
  /**
   * The value as stored, the field's empty value (`undefined` or `null`)
   * included. A control that needs a defined value maps it
   * (`value={value ?? ""}`), or it turns uncontrolled once the field empties.
   */
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
  /** The field is disabled, by its own `disabled` or the form's. */
  isDisabled: boolean
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
    Number.isNaN(value) ||
    (Array.isArray(value) && value.length === 0)
  )
}

// A React synthetic event, from spreading the control props on a native input
// or an event-emitting component. Storing it would put the event in the form.
function isSyntheticEvent(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    "nativeEvent" in value &&
    "target" in value
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
  const isDisabled = useIsFormDisabled(field.form) || Boolean(disabled)
  // `field` is rebuilt on every value change; these members aren't, so a
  // control that memoizes on `onChange` doesn't see a new one each render.
  const { form, handleBlur, handleChange, name } = field
  const onChange = useCallback(
    (value: TValue) => {
      if (isSyntheticEvent(value)) {
        throw new TypeError(
          `Field "${name}" got a change event, not a value. Map it in the control: onChange(event.target.value).`
        )
      }
      handleChange(
        isEmpty(value)
          ? (emptyValueFor(
              getFormSchema(form),
              form.state.values,
              name,
              value
            ) as TValue)
          : value
      )
    },
    [form, handleChange, name]
  )

  return {
    controlProps: {
      "aria-describedby": describedBy(
        [description, descriptionId],
        [showError, errorId]
      ),
      "aria-invalid": isInvalid || undefined,
      "aria-labelledby": labelId,
      "aria-required": isRequired || undefined,
      disabled: isDisabled,
      id,
      name,
      onBlur: handleBlur,
      onChange,
      value: field.state.value,
    },
    descriptionId,
    errorId,
    errors: showError ? field.state.meta.errors : [],
    id,
    isDisabled,
    isInvalid,
    isRequired,
    labelId,
    name,
    showRequiredIndicator: required ?? schemaRequired,
  }
}

export type { FieldControl, FieldControlProps, UseFieldControlOptions }
export { useFieldControl }
