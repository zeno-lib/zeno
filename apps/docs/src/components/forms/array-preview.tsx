"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import { Button } from "@zeno-lib/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { Field, FieldGroup, FieldLegend, FieldSet } from "@zeno-lib/ui/field"
import { TrashIcon } from "lucide-react"
import { z } from "zod"

import { toastSubmitted } from "./preview-utils"

const memberSchema = z.object({
  email: z.email("Enter a valid email"),
  name: z.string().min(1, "Name is required"),
})
const teamSchema = z.object({
  members: z.array(memberSchema).min(1, "Add at least one member"),
})

type Member = z.infer<typeof memberSchema>

export function ArrayExample() {
  const form = useForm({
    defaultValues: { members: [{ email: "", name: "" }] as Member[] },
    onSubmit: ({ value }) => toastSubmitted(value),
    schema: teamSchema,
  })
  const {
    EmailField,
    Field: ArrayField,
    InputField,
    ResetButton,
    SubmitButton,
  } = form
  return (
    <FormProvider form={form}>
      <Card className="w-full max-w-xl">
        <CardHeader>
          <CardTitle>Invite team members</CardTitle>
          <CardDescription>
            Add as many teammates as you need — each row is its own array entry.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="team-form">
            <FieldGroup>
              <ArrayField mode="array" name="members">
                {(arrayField) => (
                  <FieldSet>
                    <FieldLegend>Members</FieldLegend>
                    {arrayField.state.value.map((_, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: tanstack form rows are keyed by index
                      <div className="flex items-end gap-2" key={index}>
                        <div className="flex-1">
                          <InputField
                            label={index === 0 ? "Name" : undefined}
                            name={`members[${index}].name`}
                            placeholder="Ada Lovelace"
                          />
                        </div>
                        <div className="flex-1">
                          <EmailField
                            label={index === 0 ? "Email" : undefined}
                            name={`members[${index}].email`}
                          />
                        </div>
                        <Button
                          aria-label={`Remove member ${index + 1}`}
                          onClick={() => arrayField.removeValue(index)}
                          size="icon"
                          type="button"
                          variant="ghost"
                        >
                          <TrashIcon />
                        </Button>
                      </div>
                    ))}
                    <Button
                      onClick={() =>
                        arrayField.pushValue({ email: "", name: "" })
                      }
                      type="button"
                      variant="outline"
                    >
                      Add member
                    </Button>
                  </FieldSet>
                )}
              </ArrayField>
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="team-form">Send invites</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
