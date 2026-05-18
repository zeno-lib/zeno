/* biome-ignore-all lint/performance/noBarrelFile: so consumers depend only on `@zeno-lib/forms`. */
"use client"

import { type AnyFormApi, createFormHook } from "@tanstack/react-form"
import type { ComponentProps, FormEvent, ReactNode } from "react"

import { CheckboxField } from "./fields/checkbox-field"
import { ComboboxField } from "./fields/combobox-field"
import { DatePickerField } from "./fields/date-picker-field"
import { EmailField } from "./fields/email-field"
import { InputField } from "./fields/input-field"
import { NumberField } from "./fields/number-field"
import { OtpField } from "./fields/otp-field"
import { PasswordField } from "./fields/password-field"
import { RadioGroupField } from "./fields/radio-group-field"
import { ResetButton } from "./fields/reset-button"
import { SelectField } from "./fields/select-field"
import { SliderField } from "./fields/slider-field"
import { SubmitButton } from "./fields/submit-button"
import { SwitchField } from "./fields/switch-field"
import { TextAreaField } from "./fields/textarea-field"
import {
  fieldContext,
  formContext,
  FormProvider as RawFormProvider,
  useFormContext,
} from "./lib/contexts"

export * from "./addons"
export { RadioGroupFieldItem } from "./fields/radio-group-field"
export { applyValidationError } from "./lib/apply-validation-error"
export { useFieldContext, useFormContext } from "./lib/contexts"
export {
  RequiredIndicator,
  type RequiredIndicatorProps,
} from "./lib/required-indicator"
export {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "./lib/use-is-invalid"
export { type FieldMessage, ValidationError } from "./lib/validation-error"
export { blurThenChangeLogic } from "./lib/validation-logic"
export type { ValidationMode } from "./lib/validation-modes"
export { useAppFields } from "./use-app-fields"
export { useForm } from "./use-form"

const { useAppForm, withFieldGroup, withForm } = createFormHook({
  fieldComponents: {
    CheckboxField,
    ComboboxField,
    DatePickerField,
    EmailField,
    InputField,
    NumberField,
    OtpField,
    PasswordField,
    RadioGroupField,
    SelectField,
    SliderField,
    SwitchField,
    TextAreaField,
  },
  fieldContext,
  formComponents: {
    ResetButton,
    SubmitButton,
  },
  formContext,
})

export { useAppForm, withFieldGroup, withForm }

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
