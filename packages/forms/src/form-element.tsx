"use client"

import type { AnyFormApi } from "@tanstack/react-form"
import {
  type ComponentProps,
  type FormEvent,
  type ReactNode,
  useMemo,
} from "react"

import { FormProvider as RawFormProvider, useFormContext } from "./lib/contexts"
import { focusFirstInvalid, restoreFocus } from "./lib/focus-first-invalid"
import { FormDisabledContext, useIsFormDisabled } from "./lib/form-disabled"
import { reportSubmitError } from "./lib/submit-error"

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
  const { store } = form as AnyFormApi
  const scope = useMemo(() => ({ disabled, key: store }), [disabled, store])
  return (
    <RawFormProvider value={form as AnyFormApi}>
      <FormDisabledContext value={scope}>{children}</FormDisabledContext>
    </RawFormProvider>
  )
}

type FormProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  /**
   * Disable every field and button of the kit inside, and ignore a submit. A
   * field's own `disabled` still applies. A button outside the `<form>`
   * (`form="id"`) isn't inside: disable the form with `useForm({ disabled })`
   * or `<FormProvider disabled>` to reach it.
   */
  disabled?: boolean
}

function Form({ children, className, disabled = false, ...props }: FormProps) {
  const form = useFormContext()
  const isDisabled = useIsFormDisabled(form) || disabled
  const { store } = form
  const scope = useMemo(
    () => ({ disabled: isDisabled, key: store }),
    [isDisabled, store]
  )
  return (
    <FormDisabledContext value={scope}>
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
