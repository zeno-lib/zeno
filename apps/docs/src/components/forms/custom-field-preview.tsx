"use client"

import {
  Form,
  FormProvider,
  useFieldContext,
  useForm,
  useIsInvalid,
} from "@zeno-lib/forms"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@zeno-lib/ui/field"
import { Slider } from "@zeno-lib/ui/slider"
import { toast } from "@zeno-lib/ui/sonner"
import { z } from "zod"

function VolumeField({ label }: { label: string }) {
  const field = useFieldContext<number>()
  const isInvalid = useIsInvalid(field)
  const value = field.state.value ?? 0
  return (
    <Field data-invalid={isInvalid}>
      <FieldLabel htmlFor={field.name}>
        {label}: {value}
      </FieldLabel>
      <Slider
        id={field.name}
        max={100}
        min={0}
        onValueChange={(next) =>
          field.handleChange(Array.isArray(next) ? (next[0] ?? 0) : next)
        }
        step={1}
        value={[value]}
      />
      <FieldDescription>Drag to set the master volume.</FieldDescription>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  )
}

const audioSchema = z.object({
  volume: z.number().min(0).max(100),
})

export function CustomFieldPreview() {
  const form = useForm({
    defaultValues: { volume: 35 },
    onSubmit: ({ value }) => {
      toast.success("Volume applied", { description: String(value.volume) })
    },
    schema: audioSchema,
  })
  const { AppField, ResetButton, SubmitButton } = form

  return (
    <FormProvider form={form}>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Audio settings</CardTitle>
          <CardDescription>
            Custom slider field built on top of `useFieldContext`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="audio-form">
            <FieldGroup>
              <AppField name="volume">
                {() => <VolumeField label="Volume" />}
              </AppField>
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="audio-form">Apply</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
