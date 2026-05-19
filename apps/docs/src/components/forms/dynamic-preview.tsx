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
import { Field, FieldGroup, FieldLegend, FieldSet } from "@zeno-lib/ui/field"
import { SelectItem } from "@zeno-lib/ui/select"
import { z } from "zod"

import { toastSubmitted, wrapperClass } from "./preview-utils"

type Diet = "none" | "vegetarian" | "vegan"

export function DynamicExample() {
  const form = useForm({
    onSubmit: ({ value }) => toastSubmitted(value),
    schema: z.object({
      dietary: z.enum(["none", "vegetarian", "vegan"]).default("none"),
      meals: z.object({
        eggs: z.boolean().default(true),
        salad: z.boolean().default(true),
        sausage: z.boolean().default(true),
      }),
    }),
  })
  const { CheckboxField, ResetButton, SelectField, SubmitButton } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Order</CardTitle>
          <CardDescription>
            Switching dietary preference unticks incompatible meals
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="cascade-form">
            <FieldGroup>
              <SelectField
                label="Dietary restrictions"
                listeners={{
                  onChange: ({ value }: { value: Diet }) => {
                    if (value !== "none") {
                      form.setFieldValue("meals.sausage", false)
                    }
                    if (value === "vegan") {
                      form.setFieldValue("meals.eggs", false)
                    }
                  },
                }}
                name="dietary"
              >
                <SelectItem value="none">No restrictions</SelectItem>
                <SelectItem value="vegetarian">Vegetarian</SelectItem>
                <SelectItem value="vegan">Vegan</SelectItem>
              </SelectField>
              <FieldSet>
                <FieldLegend>Meals</FieldLegend>
                <FieldGroup className="gap-3">
                  <CheckboxField label="Salad" name="meals.salad" />
                  <CheckboxField label="Sausage" name="meals.sausage" />
                  <CheckboxField label="Eggs" name="meals.eggs" />
                </FieldGroup>
              </FieldSet>
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="cascade-form">Save</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
