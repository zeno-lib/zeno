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
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters"),
})

function errorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string") {
      return message
    }
  }
  return "Invalid"
}

export function ErrorSummaryExample() {
  const form = useForm({
    hideFieldErrors: true,
    onSubmit: ({ value }) =>
      toastSubmitted({ email: value.email, password: "•••" }),
    schema,
  })
  const { EmailField, PasswordField, ResetButton, SubmitButton, Subscribe } =
    form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            Errors collected at the bottom — fields stay clean.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Form id="error-summary-form">
            <FieldGroup>
              <EmailField placeholder="you@zeno.dev" />
              <PasswordField />
            </FieldGroup>
          </Form>
          <Subscribe
            selector={(state) =>
              [state.fieldMeta, state.submissionAttempts > 0] as const
            }
          >
            {([fieldMeta, wasSubmitted]) => {
              const items = Object.entries(fieldMeta).flatMap(([name, meta]) =>
                meta && (meta.isBlurred || wasSubmitted) && !meta.isValid
                  ? meta.errors.map((error: unknown) => ({
                      field: name,
                      message: errorMessage(error),
                    }))
                  : []
              )
              if (items.length === 0) {
                return null
              }
              return (
                <ul
                  aria-live="polite"
                  className="space-y-1 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-destructive text-sm"
                  role="alert"
                >
                  {items.map((item, i) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: derived from a stable filter over fieldMeta
                    <li key={i}>
                      <strong className="capitalize">{item.field}:</strong>{" "}
                      {item.message}
                    </li>
                  ))}
                </ul>
              )
            }}
          </Subscribe>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="error-summary-form">Sign in</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
