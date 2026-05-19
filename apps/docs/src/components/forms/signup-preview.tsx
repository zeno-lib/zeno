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

const signupSchema = z
  .object({
    confirmPassword: z.string(),
    email: z.email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  })

export function SignupExample() {
  const form = useForm({
    onSubmit: ({ value }) =>
      toastSubmitted({ email: value.email, password: "•••" }),
    schema: signupSchema,
  })
  const { EmailField, PasswordField, ResetButton, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Create your account</CardTitle>
          <CardDescription>
            Pick an email and password — confirmation must match.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="signup-form">
            <FieldGroup>
              <EmailField placeholder="you@zeno.dev" />
              <PasswordField autoComplete="new-password" />
              <PasswordField
                autoComplete="new-password"
                label="Confirm password"
                name="confirmPassword"
              />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="signup-form">Create account</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
