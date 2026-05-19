"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { Field, FieldGroup } from "@zeno-lib/ui/field"
import { toast } from "@zeno-lib/ui/sonner"
import { z } from "zod"

import { wrapperClass } from "./preview-utils"

const slugRegex = /^[a-z0-9-]+$/
const formSchema = z.object({
  email: z.email("Enter a valid email"),
  name: z.string().min(2, "At least 2 characters"),
  slug: z
    .string()
    .min(3, "At least 3 characters")
    .regex(slugRegex, "Lowercase letters, numbers, and dashes only"),
})

const RESERVED_SLUGS = new Set(["admin", "api", "app", "billing", "settings"])

const slugAvailability = z
  .string()
  .refine((value) => !RESERVED_SLUGS.has(value), {
    error: "That slug is reserved — pick another",
  })

export function MixedValidationExample() {
  const form = useForm({
    onSubmit: ({ value }) => {
      toast.success("Workspace created", {
        description: `${value.name} (${value.slug})`,
      })
    },
    schema: formSchema,
  })
  const { EmailField, InputField, ResetButton, SubmitButton } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Create workspace</CardTitle>
          <CardDescription>
            Slug also runs a reserved-name check via a per-field validator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="workspace-form">
            <FieldGroup>
              <InputField
                label="Workspace name"
                name="name"
                placeholder="Resolve"
              />
              <EmailField placeholder="you@zeno.dev" />
              <InputField
                description={`Try "admin" or "api" to see the per-field check.`}
                label="Slug"
                name="slug"
                placeholder="resolve"
                validators={{ onChange: slugAvailability }}
              />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="workspace-form">Create workspace</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
