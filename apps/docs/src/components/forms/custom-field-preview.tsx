"use client"

import { Form, FormProvider, useForm } from "@zeno-lib/forms/create-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@zeno-lib/ui/card"
import { Field, FieldGroup } from "@zeno-lib/ui/field"
import { cn } from "@zeno-lib/ui/lib/utils"
import { toast } from "@zeno-lib/ui/sonner"
import { StarIcon } from "lucide-react"
import type { ComponentProps } from "react"
import { z } from "zod"

type StarRatingProps = Omit<ComponentProps<"div">, "onChange"> & {
  disabled?: boolean
  name?: string
  onChange: (value: number) => void
  value?: number | null
}

// A controlled component the field kit has no field for: it takes `value` and
// reports `onChange(value)`.
function StarRating({
  className,
  disabled,
  name,
  onChange,
  value,
  ...props
}: StarRatingProps) {
  return (
    <div className={cn("flex gap-1", className)} role="radiogroup" {...props}>
      {[1, 2, 3, 4, 5].map((star) => (
        // biome-ignore lint/a11y/useSemanticElements: a star is a radio drawn as a button.
        <button
          aria-checked={value === star}
          aria-label={`${star} of 5`}
          className="rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-checked:text-foreground"
          disabled={disabled}
          key={star}
          onClick={() => onChange(star)}
          role="radio"
          type="button"
        >
          <StarIcon
            className={cn("size-6", value && star <= value && "fill-current")}
          />
        </button>
      ))}
      <input name={name} type="hidden" value={value ?? ""} />
    </div>
  )
}

const reviewSchema = z.object({
  rating: z.number("Pick a rating"),
})

export function CustomFieldPreview() {
  const form = useForm({
    onSubmit: ({ value }) => {
      toast.success("Thanks for the review", {
        description: `${value.rating} of 5`,
      })
    },
    schema: reviewSchema,
  })
  const { ControlField, ResetButton, SubmitButton } = form

  return (
    <FormProvider form={form}>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Review</CardTitle>
          <CardDescription>
            A custom star rating, bound with `ControlField`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form id="review-form">
            <FieldGroup>
              <ControlField
                description="Tap a star."
                label="Rating"
                name="rating"
                render={(control) => <StarRating {...control} />}
              />
            </FieldGroup>
          </Form>
        </CardContent>
        <CardFooter>
          <Field orientation="horizontal">
            <ResetButton />
            <SubmitButton form="review-form">Send</SubmitButton>
          </Field>
        </CardFooter>
      </Card>
    </FormProvider>
  )
}
