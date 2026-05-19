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
import { SelectItem } from "@zeno-lib/ui/select"
import { z } from "zod"

import { toastSubmitted, wrapperClass } from "./preview-utils"

const categories = [
  { id: 1, name: "Technology" },
  { id: 2, name: "Design" },
  { id: 3, name: "Marketing" },
]

export function SelectNumberExample() {
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
  const { SelectField, ResetButton, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Assign category</CardTitle>
          <CardDescription>
            Submit to see the ID arrive as a number, not a string.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="select-number-form">
            <FieldGroup>
              <SelectField
                label="Category"
                name="categoryId"
                placeholder="Pick a category"
              >
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectField>
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="select-number-form">Save</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
