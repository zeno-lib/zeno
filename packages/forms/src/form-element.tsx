"use client"

import type { AnyFormApi } from "@tanstack/react-form"
import type { ComponentProps, FormEvent, ReactNode } from "react"

import { FormProvider as RawFormProvider, useFormContext } from "./lib/contexts"
import { focusFirstInvalid, restoreFocus } from "./lib/focus-first-invalid"
import { FormDisabledContext, useIsFormDisabled } from "./lib/form-disabled"
import { reportSubmitError } from "./lib/submit-error"
import { getFormDisabled } from "./lib/validation-modes"

type FormProviderProps = {
  children: ReactNode
  /**
   * Disable every field of the form and its submit button, as
   * `useForm({ disabled })` does. A field's own `disabled` still applies.
   */
  disabled?: boolean
  form: { handleSubmit: () => unknown }
}

function FormProvider({ children, disabled = false, form }: FormProviderProps) {
  const isDisabled = disabled || getFormDisabled(form as AnyFormApi)
  return (
    <RawFormProvider value={form as AnyFormApi}>
      <FormDisabledContext value={isDisabled}>{children}</FormDisabledContext>
    </RawFormProvider>
  )
}

type FormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  /**
   * Disable every field inside and the submit button, and ignore a submit.
   * A field's own `disabled` still applies.
   */
  disabled?: boolean
}

function Form({ children, className, disabled = false, ...props }: FormProps) {
  const form = useFormContext()
  const isDisabled = useIsFormDisabled(form) || disabled
  return (
    <FormDisabledContext value={isDisabled}>
      <form
        className={className}
        noValidate
        onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          event.preventDefault()
          event.stopPropagation()
          // A `<button form={id}>` outside the form can still submit it.
          if (isDisabled) {
            return
          }
          const node = event.currentTarget
          const focused = node.ownerDocument.activeElement
          // Caught so the user can retry; `useForm` keeps it for `FormError`.
          await Promise.resolve(form.handleSubmit()).catch(reportSubmitError)
          const { isSubmitSuccessful, isValid } = form.state
          if (!isValid && focusFirstInvalid(node)) {
            return
          }
          // A form-level failure has no field to fix, so focus stays where it
          // was, or goes back there if the submit button's disabling dropped it.
          if (!(isValid && isSubmitSuccessful)) {
            restoreFocus(focused)
          }
        }}
        {...props}
      >
        {children}
      </form>
    </FormDisabledContext>
  )
}

export { Form, FormProvider }
