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
import { type ComponentProps, type KeyboardEvent, useRef } from "react"
import { z } from "zod"

type StarRatingProps = Omit<ComponentProps<"div">, "onChange"> & {
  disabled?: boolean
  name?: string
  onChange: (value: number) => void
  value?: number | null
}

const STARS = [1, 2, 3, 4, 5]
const STEPS: Record<string, number> = {
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -1,
}

// A controlled component the field kit has no field for: it takes `value` and
// reports `onChange(value)`. As a radio group, it is one tab stop (the checked
// star, or the first), and the arrow keys move and select.
function StarRating({
  className,
  disabled,
  name,
  onChange,
  value,
  ...props
}: StarRatingProps) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const current = value ?? 1

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const step = STEPS[event.key]
    if (!step || disabled) {
      return
    }
    event.preventDefault()
    const next = ((current - 1 + step + STARS.length) % STARS.length) + 1
    onChange(next)
    buttons.current[next - 1]?.focus()
  }

  return (
    <div
      className={cn("flex gap-1", className)}
      onKeyDown={onKeyDown}
      role="radiogroup"
      {...props}
    >
      {STARS.map((star) => (
        // biome-ignore lint/a11y/useSemanticElements: a star is a radio drawn as a button.
        <button
          aria-checked={value === star}
          aria-label={`${star} of 5`}
          className="rounded-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 aria-checked:text-foreground"
          disabled={disabled}
          key={star}
          onClick={() => onChange(star)}
          ref={(button) => {
            buttons.current[star - 1] = button
          }}
          role="radio"
          tabIndex={star === current ? 0 : -1}
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
