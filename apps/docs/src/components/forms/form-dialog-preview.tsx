"use client"

import { useForm } from "@zeno-lib/forms/create-form"
import { FormDialog } from "@zeno-lib/forms/form-dialog"
import { useFormDialog } from "@zeno-lib/forms/lib/use-form-dialog"
import { Button } from "@zeno-lib/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { FieldGroup } from "@zeno-lib/ui/field"
import { useState } from "react"
import { z } from "zod"

import { toastSubmitted, wrapperClass } from "./preview-utils"

const memberSchema = z.object({
  email: z.email("Enter a valid email"),
  name: z.string().min(1, "Name is required"),
})
type Member = z.infer<typeof memberSchema>

const BLANK: Member = { email: "", name: "" }
const OFFLINE = "offline@example.com"
const INITIAL: Member[] = [
  { email: "ada@example.com", name: "Ada Lovelace" },
  { email: "grace@example.com", name: "Grace Hopper" },
]

export function FormDialogExample() {
  const [members, setMembers] = useState(INITIAL)
  const [editing, setEditing] = useState<number | null>(null)
  const dialog = useFormDialog({ defaultValues: BLANK })
  const form = useForm({
    defaultValues: dialog.defaultValues,
    onSubmit: async ({ value }) => {
      await new Promise((resolve) => setTimeout(resolve, 600))
      if (value.email === OFFLINE) {
        // Stands in for a network failure: the dialog stays open and shows
        // a generic message above its footer.
        throw new Error("Network request failed")
      }
      setMembers((current) =>
        editing === null
          ? [...current, value]
          : current.map((member, i) => (i === editing ? value : member))
      )
      toastSubmitted(value)
    },
    schema: memberSchema,
  })
  const { EmailField, InputField } = form

  return (
    <Card className={wrapperClass}>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Edit a row, change something, then press Escape. Save with{" "}
          <code>{OFFLINE}</code> to see a failed save.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {members.map((member, index) => (
          <div
            className="flex items-center justify-between gap-2 text-sm"
            key={member.email}
          >
            <span>{member.name}</span>
            <Button
              onClick={() => {
                setEditing(index)
                dialog.open({ defaultValues: member, focus: "email" })
              }}
              size="sm"
              variant="outline"
            >
              Edit
            </Button>
          </div>
        ))}
        <FormDialog
          description="Changes are kept until you save or discard them."
          dialog={dialog}
          form={form}
          title={editing === null ? "New member" : "Edit member"}
          trigger={<Button onClick={() => setEditing(null)}>Add member</Button>}
        >
          <FieldGroup>
            <InputField label="Name" name="name" />
            <EmailField label="Email" name="email" />
          </FieldGroup>
        </FormDialog>
      </CardContent>
    </Card>
  )
}
