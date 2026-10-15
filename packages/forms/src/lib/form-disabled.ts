"use client"

import type { AnyFormApi } from "@tanstack/react-form"
import { createContext, useContext } from "react"

import { getFormDisabled } from "./validation-modes"

/**
 * Whether the form around is disabled. `FormProvider` sets it for its form,
 * from its `disabled` prop and `useForm({ disabled })`, and `<Form disabled>`
 * for what it wraps. A provider doesn't inherit it, so a form rendered inside
 * another (a dialog's) keeps its own state.
 */
const FormDisabledContext = createContext<boolean>(false)

/**
 * Whether the form is disabled, by `useForm({ disabled })`,
 * `<FormProvider disabled>`, `<Form disabled>` or `FormDialog`'s `disabled`.
 * Every kit field reads it, so a control the fieldset of a disabled dialog
 * can't reach (a checkbox, a switch, a radio, a slider) turns off too.
 *
 * Inside a field, pass `field.form`: `useForm({ disabled })` then applies even
 * where no provider of the form is mounted.
 */
function useIsFormDisabled(form?: AnyFormApi): boolean {
  const disabled = useContext(FormDisabledContext)
  return disabled || (form ? getFormDisabled(form) : false)
}

export { FormDisabledContext, useIsFormDisabled }
