"use client"

import {
  Form,
  FormProvider,
  RadioGroupFieldItem,
  useForm,
} from "@zeno-lib/forms/create-form"
import { FieldGroup } from "@zeno-lib/ui/field"
import { SelectItem } from "@zeno-lib/ui/select"
import { z } from "zod"

const wrapperClass = "w-full max-w-sm"

export function InputFieldPreview() {
  const form = useForm({
    schema: z.object({ name: z.string().min(2, "At least 2 characters") }),
  })
  const { InputField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <InputField
            description="Shown next to your avatar."
            label="Display name"
            name="name"
            placeholder="Ada Lovelace"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function EmailFieldPreview() {
  const form = useForm({
    schema: z.object({ email: z.email("Enter a valid email") }),
  })
  const { EmailField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <EmailField name="email" placeholder="you@zeno.dev" />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function PasswordFieldPreview() {
  const form = useForm({
    schema: z.object({
      password: z.string().min(8, "At least 8 characters"),
    }),
  })
  const { PasswordField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <PasswordField autoComplete="new-password" name="password" />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function TextAreaFieldPreview() {
  const form = useForm({
    schema: z.object({
      bio: z.string().max(160, "Keep it under 160 characters"),
    }),
  })
  const { TextAreaField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <TextAreaField
            description="160 characters max."
            label="Bio"
            name="bio"
            placeholder="I build things on the web."
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function NumberFieldPreview() {
  const form = useForm({
    defaultValues: { age: 18 as number | undefined },
    schema: z.object({
      age: z
        .number({ error: "Enter your age" })
        .int()
        .min(13, "Must be at least 13"),
    }),
  })
  const { NumberField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <NumberField label="Age" min={13} name="age" />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function SelectFieldPreview() {
  const form = useForm({
    defaultValues: { role: "" },
    schema: z.object({
      role: z.enum(["engineer", "designer", "manager"], {
        error: "Pick a role",
      }),
    }),
  })
  const { SelectField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <SelectField label="Role" name="role" placeholder="Pick a role">
            <SelectItem value="engineer">Engineer</SelectItem>
            <SelectItem value="designer">Designer</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
          </SelectField>
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function CheckboxFieldPreview() {
  const form = useForm({
    defaultValues: { terms: false },
    schema: z.object({
      terms: z.literal(true, { error: "You must accept the terms" }),
    }),
  })
  const { CheckboxField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <CheckboxField
            description="You can revoke this at any time."
            label="I accept the terms of service"
            name="terms"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function SwitchFieldPreview() {
  const form = useForm({
    defaultValues: { pushNotifications: true },
  })
  const { SwitchField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <SwitchField
            description="Get notified when something needs your attention."
            label="Push notifications"
            name="pushNotifications"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function RadioGroupFieldPreview() {
  const form = useForm({
    defaultValues: { plan: "free" },
  })
  const { RadioGroupField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <RadioGroupField label="Plan" name="plan">
            <RadioGroupFieldItem value="free">Free</RadioGroupFieldItem>
            <RadioGroupFieldItem value="pro">Pro</RadioGroupFieldItem>
            <RadioGroupFieldItem value="team">Team</RadioGroupFieldItem>
          </RadioGroupField>
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function SliderFieldPreview() {
  const form = useForm({
    defaultValues: { volume: 50 },
  })
  const { SliderField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <SliderField
            description="Used for notification chimes."
            formatValue={(v) => `${Array.isArray(v) ? v[0] : v}%`}
            label="Volume"
            max={100}
            min={0}
            name="volume"
            step={1}
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function OtpFieldPreview() {
  const form = useForm({
    schema: z.object({
      code: z.string().length(6, "Enter the 6-digit code"),
    }),
  })
  const { OtpField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <OtpField
            description="We sent a code to your email."
            label="Verification code"
            name="code"
            pattern="^[0-9]+$"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function DatePickerFieldPreview() {
  const form = useForm({
    defaultValues: { birthday: undefined as Date | undefined },
    schema: z.object({
      birthday: z.date({ error: "Pick a date" }),
    }),
  })
  const { DatePickerField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <DatePickerField
            description="Used for age-restricted features."
            label="Birthday"
            name="birthday"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

const FRAMEWORKS = [
  "Next.js",
  "Remix",
  "SvelteKit",
  "Nuxt.js",
  "Astro",
  "SolidStart",
  "Qwik",
]

export function ComboboxFieldPreview() {
  const form = useForm({
    schema: z.object({
      framework: z.string().min(1, "Pick a framework"),
    }),
  })
  const { ComboboxField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <ComboboxField
            description="Filter as you type."
            emptyMessage="No framework matches."
            items={FRAMEWORKS}
            label="Favourite framework"
            name="framework"
            placeholder="Search frameworks…"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function MoneyFieldPreview() {
  const form = useForm({
    schema: z.object({
      budget: z.number("Enter an amount").positive("Must be positive"),
    }),
  })
  const { MoneyField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <MoneyField
            currency="CHF"
            description="Try pasting 1.234,50 or CHF 12'000."
            label="Budget"
            locale="de-CH"
            name="budget"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function PercentageFieldPreview() {
  const form = useForm({
    defaultValues: { rate: 0.025 },
    schema: z.object({
      rate: z.number("Enter a rate").max(1, "At most 100 %"),
    }),
  })
  const { PercentageField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <PercentageField
            description="Stored as a 0–1 ratio (scale='fraction')."
            label="Interest rate"
            name="rate"
            scale="fraction"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function YearFieldPreview() {
  const form = useForm({
    schema: z.object({
      founded: z.number("Enter a year").int(),
    }),
  })
  const { YearField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <YearField
            description="Clamped to 1900–2100 on blur."
            label="Founded"
            max={2100}
            min={1900}
            name="founded"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

const LANGUAGES = [
  { label: "English", value: "en" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Italian", value: "it" },
  { label: "Spanish", value: "es" },
]

export function MultiSelectFieldPreview() {
  const form = useForm({
    schema: z.object({
      languages: z.array(z.string()).min(1, "Pick at least one language"),
    }),
  })
  const { MultiSelectField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <MultiSelectField
            description="Stored as an array of values."
            items={LANGUAGES}
            label="Languages"
            name="languages"
            placeholder="Search languages…"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function CheckboxGroupFieldPreview() {
  const form = useForm({
    schema: z.object({
      channels: z.array(z.string()).min(1, "Pick at least one channel"),
    }),
  })
  const { CheckboxGroupField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <CheckboxGroupField
            description="Where should we reach you?"
            items={[
              { label: "Email", value: "email" },
              { label: "SMS", value: "sms" },
              {
                description: "Coming soon.",
                disabled: true,
                label: "Push",
                value: "push",
              },
            ]}
            label="Notification channels"
            name="channels"
          />
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}
