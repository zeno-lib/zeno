"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import { Badge } from "@zeno-lib/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { Field, FieldGroup } from "@zeno-lib/ui/field"

import { toastSubmitted, wrapperClass } from "./preview-utils"

export function UnsavedChangesExample() {
  const form = useForm({
    defaultValues: { body: "", title: "" },
    onSubmit: ({ formApi, value }) => {
      toastSubmitted(value)
      // Rebase defaults to the just-saved values so the form is no
      // longer "different from defaults" — the badge clears.
      formApi.reset(value)
    },
    unsavedChangesWarning: "if-changed",
  })
  const { InputField, ResetButton, Subscribe, SubmitButton, TextAreaField } =
    form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>
            Edit post{" "}
            <Subscribe selector={(state) => !state.isDefaultValue}>
              {(changed) =>
                changed ? (
                  <Badge variant="destructive">Unsaved changes</Badge>
                ) : null
              }
            </Subscribe>
          </CardTitle>
          <CardDescription>
            Type something, then close the tab — the browser prompts before
            navigating away. Submit or reset to clear the dirty state.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="unsaved-changes-form">
            <FieldGroup>
              <InputField label="Title" name="title" placeholder="Post title" />
              <TextAreaField
                label="Body"
                name="body"
                placeholder="Write your post…"
                rows={4}
              />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="unsaved-changes-form">Save</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
