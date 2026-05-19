"use client"

import { Form, FormProvider, useForm, ValidationSpinner } from "@zeno-lib/forms"
import { FieldGroup } from "@zeno-lib/ui/field"
import {
  InputGroupAddon,
  InputGroupButton,
  InputGroupText,
} from "@zeno-lib/ui/input-group"
import { BoldIcon, ItalicIcon, MailIcon } from "lucide-react"
import { z } from "zod"

const wrapperClass = "w-full max-w-sm"

export function AddonInlineIconPreview() {
  const form = useForm({
    schema: z.object({ email: z.email("Enter a valid email") }),
  })
  const { EmailField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <EmailField placeholder="you@zeno.dev">
            <InputGroupAddon align="inline-start">
              <MailIcon />
            </InputGroupAddon>
          </EmailField>
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function AddonInlineTextPreview() {
  const form = useForm({
    schema: z.object({
      handle: z.string().min(1, "Enter a handle"),
    }),
  })
  const { InputField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <InputField label="Handle" name="handle" placeholder="acme">
            <InputGroupAddon align="inline-start">
              <InputGroupText>https://</InputGroupText>
            </InputGroupAddon>
            <InputGroupAddon align="inline-end">
              <InputGroupText>.zeno.dev</InputGroupText>
            </InputGroupAddon>
          </InputField>
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

export function AddonBlockToolbarPreview() {
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
            label="Bio"
            name="bio"
            placeholder="I build things on the web."
          >
            <InputGroupAddon align="block-start">
              <InputGroupButton type="button">
                <BoldIcon />
              </InputGroupButton>
              <InputGroupButton type="button">
                <ItalicIcon />
              </InputGroupButton>
            </InputGroupAddon>
          </TextAreaField>
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}

async function fakeCheckEmail(email: string) {
  await new Promise((resolve) => setTimeout(resolve, 800))
  return email === "taken@example.com"
}

export function AddonValidationSpinnerPreview() {
  const form = useForm({
    schema: z.object({ email: z.email("Enter a valid email") }),
  })
  const { EmailField } = form
  return (
    <FormProvider form={form}>
      <Form className={wrapperClass}>
        <FieldGroup>
          <EmailField
            placeholder="Try taken@example.com"
            validators={{
              onChangeAsync: async ({ value }: { value: string }) => {
                const taken = await fakeCheckEmail(value)
                return taken ? "Email already in use" : undefined
              },
              onChangeAsyncDebounceMs: 500,
            }}
          >
            <ValidationSpinner />
          </EmailField>
        </FieldGroup>
      </Form>
    </FormProvider>
  )
}
