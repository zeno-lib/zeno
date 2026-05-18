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
import { z } from "zod"

import { toastSubmitted, wrapperClass } from "./preview-utils"

const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
})

export function LoginExample() {
  const form = useForm({
    onSubmit: ({ value }) =>
      toastSubmitted({ email: value.email, password: "•••" }),
    schema: loginSchema,
  })
  const { EmailField, PasswordField, ResetButton, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Login to your account</CardTitle>
          <CardDescription>
            Enter your email and password to sign in.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="login-form">
            <FieldGroup>
              <EmailField placeholder="you@zeno.dev" />
              <PasswordField />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="login-form">Sign in</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
