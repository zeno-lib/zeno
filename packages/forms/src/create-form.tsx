/* biome-ignore-all lint/performance/noBarrelFile: composition root for your form. */
"use client"

import { createZenoForm } from "@zeno-lib/forms"

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

// Wire the dropped-in field components into the headless factory. Edit the
// field files under `./fields` freely — they use your own shadcn primitives.
const { useAppForm, useForm, withFieldGroup, withForm } = createZenoForm({
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
  formComponents: {
    ResetButton,
    SubmitButton,
  },
})

export * from "@zeno-lib/forms"
export { ValidationSpinner } from "./addons/validation-spinner"
export { RadioGroupFieldItem } from "./fields/radio-group-field"
export { useAppForm, useForm, withFieldGroup, withForm }
