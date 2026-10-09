"use client"

import type { AnyFormApi } from "@tanstack/react-form"
import type { ComponentProps, FormEvent, ReactNode } from "react"

import { FormProvider as RawFormProvider, useFormContext } from "./lib/contexts"
import { focusFirstInvalid, restoreFocus } from "./lib/focus-first-invalid"
import { setSubmitError } from "./lib/submit-error"

type FormProviderProps = {
  children: ReactNode
  form: { handleSubmit: () => unknown }
}

function FormProvider({ children, form }: FormProviderProps) {
  return (
    <RawFormProvider value={form as AnyFormApi}>{children}</RawFormProvider>
  )
}

type FormProps = Omit<ComponentProps<"form">, "onSubmit">

function Form({ children, className, ...props }: FormProps) {
  const form = useFormContext()
  return (
    <form
      className={className}
      noValidate
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        event.stopPropagation()
        const node = event.currentTarget
        const focused = node.ownerDocument.activeElement
        // A thrown submit becomes the form-level error `FormError` shows.
        await Promise.resolve(form.handleSubmit()).catch((error: unknown) =>
          setSubmitError(form, error)
        )
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
  )
}

export { Form, FormProvider }
