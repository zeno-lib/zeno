"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { Field, FieldGroup } from "@zeno-lib/ui/field"
import { z } from "zod"

import { toastSubmitted, wrapperClass } from "./preview-utils"

const schema = z.object({
  name: z.string().min(2, "At least 2 characters"),
})

async function fakeSave(value: unknown) {
  await new Promise((resolve) => setTimeout(resolve, 2000))
  toastSubmitted(value)
}

export function OutsideFormExample() {
  const form = useForm({
    onSubmit: ({ value }) => fakeSave(value),
    schema,
  })
  const { InputField, ResetButton, SubmitButton } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <Form id="settings-form">
            <FieldGroup>
              <InputField label="Name" name="name" placeholder="Ada Lovelace" />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="settings-form">Save</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
