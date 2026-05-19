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

const categories = [
  { label: "Technology", value: 1 },
  { label: "Design", value: 2 },
  { label: "Marketing", value: 3 },
]

export function ComboboxNumberExample() {
  const form = useForm({
    onSubmit: ({ value }) =>
      toastSubmitted({
        ...value,
        categoryIdType: typeof value.categoryId,
      }),
    schema: z.object({
      categoryId: z.number({ error: "Pick a category" }),
    }),
  })
  const { ComboboxField, ResetButton, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Search category</CardTitle>
          <CardDescription>
            Submit to see the ID arrive as a number, not a string.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="combobox-number-form">
            <FieldGroup>
              <ComboboxField
                emptyMessage="No category matches."
                items={categories}
                label="Category"
                name="categoryId"
                placeholder="Search categories…"
              />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="combobox-number-form">Save</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
