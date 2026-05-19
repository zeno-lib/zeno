"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms"
import { Button } from "@zeno-lib/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@zeno-lib/ui/dialog"
import { FieldGroup } from "@zeno-lib/ui/field"
import { toast } from "@zeno-lib/ui/sonner"
import { useState } from "react"
import { z } from "zod"

import { wrapperClass } from "./preview-utils"

const slugRegex = /^[a-z0-9-]+$/
const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(slugRegex, "Lowercase letters, numbers, and dashes only"),
})

export function DialogExample() {
  const [open, setOpen] = useState(false)
  const form = useForm({
    onSubmit: ({ value }) => {
      toast.success("Project created", {
        description: `${value.name} (${value.slug})`,
      })
      setOpen(false)
    },
    schema: projectSchema,
  })
  const { InputField, ResetButton, SubmitButton } = form

  return (
    <Card className={wrapperClass}>
      <CardHeader>
        <CardTitle>Project</CardTitle>
        <CardDescription>
          Open the dialog to create a new project.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Dialog onOpenChange={setOpen} open={open}>
          <DialogTrigger render={<Button>Create project</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New project</DialogTitle>
              <DialogDescription>
                Give your project a name and a slug to get started.
              </DialogDescription>
            </DialogHeader>
            <FormProvider form={form}>
              <Form id="project-form">
                <FieldGroup>
                  <InputField
                    label="Name"
                    name="name"
                    placeholder="Resolve admin"
                  />
                  <InputField
                    description="Used in URLs."
                    label="Slug"
                    name="slug"
                    placeholder="resolve-admin"
                  />
                </FieldGroup>
              </Form>
              <DialogFooter className="mt-4">
                <Button
                  onClick={() => setOpen(false)}
                  type="button"
                  variant="ghost"
                >
                  Cancel
                </Button>
                <ResetButton />
                <SubmitButton form="project-form">Create</SubmitButton>
              </DialogFooter>
            </FormProvider>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
