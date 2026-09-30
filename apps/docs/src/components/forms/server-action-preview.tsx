"use client"

import {
  type ActionResult,
  Form,
  FormProvider,
  submitAction,
  useForm,
} from "@zeno-lib/forms/create-form"
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
  members: z.array(z.object({ email: z.email("Enter a valid email") })),
  team: z.string().min(2, "At least 2 characters"),
})

type Team = z.infer<typeof schema>

const TAKEN = "taken@example.com"

// Stand-in for a `defineFormAction` server action: it resolves to an
// `ActionResult` instead of throwing. A member already on another team is a
// field error on that row; a reserved team name is a form-level error.
async function inviteTeam(input: Team): Promise<ActionResult<Team>> {
  await new Promise((resolve) => setTimeout(resolve, 400))
  const fieldErrors: Record<string, string[]> = {}
  for (const [index, member] of input.members.entries()) {
    if (member.email === TAKEN) {
      fieldErrors[`members[${index}].email`] = ["Already on another team."]
    }
  }
  const formErrors =
    input.team === "admin" ? ["That team name is reserved."] : []
  if (Object.keys(fieldErrors).length > 0 || formErrors.length > 0) {
    return { error: { fieldErrors, formErrors }, ok: false }
  }
  return { data: input, ok: true }
}

export function ServerActionExample() {
  const form = useForm({
    defaultValues: {
      members: [{ email: "ada@example.com" }, { email: TAKEN }],
      team: "Analytical engines",
    },
    onSubmit: async (submit) => {
      const result = await submitAction(submit, inviteTeam)
      if (result.ok) {
        toastSubmitted(result.data)
      }
    },
    schema,
  })
  const { InputField, EmailField, ResetButton, SubmitButton, Subscribe } = form

  return (
    <FormProvider form={form}>
      <Card className={wrapperClass}>
        <CardHeader>
          <CardTitle>Invite a team</CardTitle>
          <CardDescription>
            Submit as is: the second row comes back with a server error. Edit it
            to clear it. Name the team <code>admin</code> for a form-level
            error.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="server-action-form">
            <FieldGroup>
              <InputField label="Team" name="team" />
              <EmailField label="Member 1" name="members[0].email" />
              <EmailField label="Member 2" name="members[1].email" />
              <Subscribe selector={(state) => state.errorMap.onSubmit}>
                {(formError) =>
                  typeof formError === "string" ? (
                    <p className="text-destructive text-sm" role="alert">
                      {formError}
                    </p>
                  ) : null
                }
              </Subscribe>
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="server-action-form">Invite</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
