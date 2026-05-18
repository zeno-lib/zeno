"use client"

import { Form, FormProvider, useForm, ValidationSpinner } from "@zeno-lib/forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { FieldGroup } from "@zeno-lib/ui/field"
import { z } from "zod"

import { toastSubmitted, wrapperClass } from "./preview-utils"

const schema = z.object({
  email: z.email("Enter a valid email"),
  name: z.string().min(2, "At least 2 characters"),
})

async function fakeSave(value: unknown) {
  await new Promise((resolve) => setTimeout(resolve, 2000))
  toastSubmitted(value)
}

async function fakeCheckEmail(email: string) {
  await new Promise((resolve) => setTimeout(resolve, 800))
  return email === "taken@example.com"
}

export function SubmittingExample() {
  const form = useForm({
    onSubmit: ({ value }) => fakeSave(value),
    schema,
  })
  const { EmailField, InputField, ResetButton, Subscribe, SubmitButton } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Account settings</CardTitle>
          <CardDescription>
            Submit is blocked while the email check runs. Try
            "taken@example.com".
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="account-form">
            <FieldGroup>
              <InputField label="Name" name="name" placeholder="Ada Lovelace" />
              <EmailField
                name="email"
                placeholder="you@zeno.dev"
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
        </CardContent>
        <CardFooter>
          <Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <div className="flex gap-2">
                <ResetButton disabled={isSubmitting} />
                <SubmitButton form="account-form">Save changes</SubmitButton>
              </div>
            )}
          </Subscribe>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
