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

import { toastSubmitted, wrapperClass } from "./preview-utils"

export function ConditionalExample() {
  const form = useForm({
    defaultValues: { country: "US", region: "", state: "" },
    onSubmit: ({ value }) => toastSubmitted(value),
  })
  const { InputField, ResetButton, SelectField, SubmitButton, Subscribe } = form
  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Shipping address</CardTitle>
          <CardDescription>
            Switch country to see the second field swap reactively.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="shipping-form">
            <FieldGroup>
              <SelectField label="Country" name="country">
                <SelectItem value="US">United States</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectField>
              <Subscribe selector={(state) => state.values.country}>
                {(country) =>
                  country === "US" ? (
                    <SelectField
                      label="State"
                      name="state"
                      placeholder="Pick a state"
                    >
                      <SelectItem value="CA">California</SelectItem>
                      <SelectItem value="NY">New York</SelectItem>
                      <SelectItem value="TX">Texas</SelectItem>
                    </SelectField>
                  ) : (
                    <InputField
                      description="State, province, or region."
                      label="Region"
                      name="region"
                      placeholder="Region"
                    />
                  )
                }
              </Subscribe>
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="shipping-form">Save address</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
