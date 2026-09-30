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
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        event.stopPropagation()
        const node = event.currentTarget
        await Promise.resolve(form.handleSubmit()).catch(() => undefined)
        if (!form.state.isValid) {
          // First invalid control in *this* form; a group root (radio group,
          // slider) hands focus to its first tabbable child.
          const invalid = node.querySelector<HTMLElement>(
            '[aria-invalid="true"]'
          )
          const targets = invalid
            ? [invalid, ...invalid.querySelectorAll<HTMLElement>("*")]
            : []
          targets.find((el) => el.tabIndex >= 0)?.focus()
        }
      }}
      {...props}
    >
      {children}
    </form>
  )
}

export { Form, FormProvider }
