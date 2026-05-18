"use client"

import { Form, FormProvider, useForm, ValidationError } from "@zeno-lib/forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { Field, FieldGroup } from "@zeno-lib/ui/field"
import { z } from "zod"

import { toastSubmitted, wrapperClass } from "./preview-utils"

const schema = z.object({
  email: z.email("Enter a valid email"),
  username: z.string().min(2, "At least 2 characters"),
})

type FormValues = z.infer<typeof schema>

// Stand-in API. "taken@example.com" and "admin" trigger field errors.
async function createAccount(value: FormValues): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  const fields: Partial<Record<keyof FormValues, string>> = {}
  if (value.email === "taken@example.com") {
    fields.email = "That email is already in use."
  }
  if (value.username === "admin") {
    fields.username = "That username is reserved."
  }
  if (Object.keys(fields).length > 0) {
    throw new ValidationError(fields)
  }
}

export function ServerErrorExample() {
  const form = useForm({
    onSubmit: async ({ value }) => {
      await createAccount(value)
      toastSubmitted(value)
    },
    schema,
  })
  const { EmailField, InputField, ResetButton, SubmitButton } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Try <code>taken@example.com</code> or <code>admin</code> to see
            server-side errors land on the right field.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="server-error-form">
            <FieldGroup>
              <InputField label="Username" name="username" placeholder="zeno" />
              <EmailField placeholder="you@zeno.dev" />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="server-error-form">Create</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
