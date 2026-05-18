"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import { RadioGroupFieldItem } from "@zeno-lib/forms/fields"
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
          <EmailField placeholder="you@zeno.dev" />
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
          <PasswordField autoComplete="new-password" />
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
