"use client"

import { describedBy } from "@zeno-lib/forms/lib/aria"
import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsFieldRequiredBySchema,
  useIsInvalid,
} from "@zeno-lib/forms/lib/use-is-invalid"
import { type ComponentProps, type ReactNode, useId, useRef } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import { RequiredIndicator } from "../lib/required-indicator"

type CalendarProps = ComponentProps<typeof Calendar>

type DatePickerFieldProps = {
  description?: ReactNode
  label?: ReactNode
  /** Trigger placeholder when the value is empty. */
  placeholder?: ReactNode
  /** Override the default `toLocaleDateString()` formatter. */
  formatValue?: (date: Date) => string
  triggerClassName?: string
  /** Pass-through to the underlying `<Calendar>` (e.g. `disabled`, `locale`). */
  calendarProps?: Omit<
    CalendarProps,
    "mode" | "onSelect" | "required" | "selected"
  >
  disabled?: boolean
  /**
   * Mark the field required, or not, over the schema. A required date shows
   * the `*`, and picking its selected day again keeps it instead of clearing.
   */
  required?: boolean
}

const FALLBACK_PLACEHOLDER = "Pick a date"

function defaultFormat(date: Date): string {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

function DatePickerField({
  calendarProps,
  description,
  disabled,
  formatValue = defaultFormat,
  label,
  placeholder = FALLBACK_PLACEHOLDER,
  required,
  triggerClassName,
}: DatePickerFieldProps) {
  const field = useFieldContext<Date | undefined>()
  // Opening the popover moves focus into it, so the trigger's blur would mark
  // the field touched, and show a required error, before a day is picked.
  // The field is touched once the popover closes, or focus leaves it closed.
  const isOpen = useRef<boolean>(false)
  const id = useId()
  const errorId = `${id}-error`
  const descriptionId = `${id}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired
  const schemaRequiresValue = useIsFieldRequiredBySchema(field)
  const requiresValue = required ?? schemaRequiresValue

  const { value } = field.state
  const empty = !value

  return (
    <Field data-field={field.name} data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={id}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <Popover
        onOpenChange={(open) => {
          isOpen.current = open
          if (!open) {
            field.handleBlur()
          }
        }}
      >
        <PopoverTrigger
          aria-describedby={describedBy(
            [description, descriptionId],
            [showError, errorId]
          )}
          aria-invalid={isInvalid || undefined}
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-full justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
            triggerClassName
          )}
          data-empty={empty || undefined}
          disabled={disabled}
          id={id}
          onBlur={() => {
            if (!isOpen.current) {
              field.handleBlur()
            }
          }}
        >
          <CalendarIcon />
          {empty ? <span>{placeholder}</span> : formatValue(value)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            onSelect={(next: Date | undefined) => field.handleChange(next)}
            required={requiresValue}
            selected={value}
            {...calendarProps}
          />
        </PopoverContent>
      </Popover>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {showError && (
        <FieldError errors={field.state.meta.errors} id={errorId} />
      )}
    </Field>
  )
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden
      className="size-4 shrink-0 opacity-60"
      fill="none"
      role="img"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>Calendar</title>
      <path d="M8 2v3M16 2v3M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
    </svg>
  )
}

export type { DatePickerFieldProps }
export { DatePickerField }
