"use client"

import type { AnyFormApi } from "@tanstack/react-form"
import type { ComponentProps, FormEvent, ReactNode } from "react"

import { FormProvider as RawFormProvider, useFormContext } from "./lib/contexts"

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
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        event.stopPropagation()
        Promise.resolve(form.handleSubmit()).catch(() => undefined)
      }}
      {...props}
    >
      {children}
    </form>
  )
}

export { Form, FormProvider }
