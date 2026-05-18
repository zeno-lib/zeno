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

const schema = z.object({
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "Include at least one uppercase letter")
    .regex(/\d/, "Include at least one digit"),
})

export function ChangeModeExample() {
  const form = useForm({
    onSubmit: ({ value }) => toastSubmitted({ password: value.password }),
    schema,
    validators: "change",
  })
  const { PasswordField, ResetButton, SubmitButton } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Pick a password</CardTitle>
          <CardDescription>
            Errors update on every keystroke — useful for live feedback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="change-mode-form">
            <FieldGroup>
              <PasswordField autoComplete="new-password" label="New password" />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="change-mode-form">Save</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
