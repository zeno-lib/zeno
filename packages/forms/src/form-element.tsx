"use client"

import type { AnyFormApi } from "@tanstack/react-form"
import type { ComponentProps, FormEvent, ReactNode, Ref } from "react"

import { FormProvider as RawFormProvider, useFormContext } from "./lib/contexts"
import { setFormElement } from "./lib/form-dom"

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

function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === "function") {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

function Form({ children, className, ref, ...props }: FormProps) {
  const form = useFormContext()
  return (
    <form
      className={className}
      noValidate
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        event.stopPropagation()
        Promise.resolve(form.handleSubmit()).catch(() => undefined)
      }}
      {...props}
      // Registers the node so submit-invalid focus stays scoped to this form.
      ref={(node) => {
        setFormElement(form, node)
        assignRef(ref, node)
      }}
    >
      {children}
    </form>
  )
}

export { Form, FormProvider }
