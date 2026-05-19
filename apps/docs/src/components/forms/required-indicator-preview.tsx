"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { FieldGroup } from "@zeno-lib/ui/field"
import { SelectItem } from "@zeno-lib/ui/select"
import { z } from "zod"

import { wrapperClass } from "./preview-utils"

const schema = z.object({
  email: z.email("Enter a valid email"),
  newsletter: z.boolean().optional(),
  password: z.string().min(8, "At least 8 characters"),
  role: z.string().default("member"),
})

export function RequiredIndicatorExample() {
  const form = useForm({
    defaultValues: {
      newsletter: false,
    },
    schema,
  })
  const { CheckboxField, EmailField, PasswordField, SelectField } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>
            Required fields show a `*`. Optional and defaulted fields stay
            quiet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form>
            <FieldGroup>
              <EmailField placeholder="you@zeno.dev" />
              <PasswordField />
              <SelectField label="Role" name="role" placeholder="Pick a role">
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectField>
              <CheckboxField
                label="Subscribe to newsletter"
                name="newsletter"
              />
            </FieldGroup>
          </Form>
        </CardContent>
      </Card>
    </FormProvider>
  )
}
