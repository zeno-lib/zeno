"use client"

import { buttonVariants } from "@zeno-lib/ui/button"
import { Calendar } from "@zeno-lib/ui/calendar"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@zeno-lib/ui/field"
import { cn } from "@zeno-lib/ui/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@zeno-lib/ui/popover"
import type { ComponentProps, ReactNode } from "react"

import { describedBy } from "../lib/aria"
import { useFieldContext } from "../lib/contexts"
import { RequiredIndicator } from "../lib/required-indicator"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "../lib/use-is-invalid"

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
  calendarProps?: Omit<CalendarProps, "mode" | "onSelect" | "selected">
  /** Force the required `*` indicator on or off. Defaults to schema-derived. */
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
  formatValue = defaultFormat,
  label,
  placeholder = FALLBACK_PLACEHOLDER,
  required,
  triggerClassName,
}: DatePickerFieldProps) {
  const field = useFieldContext<Date | undefined>()
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  const value = field.state.value
  const empty = !value

  return (
    <Field data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={field.name}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <Popover>
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
          id={field.name}
          // Base UI's Popover handles open state — we still need blur on the
          // form's reactive store. Passing onBlur here mirrors how `<select>`
          // commits on close.
          onBlur={field.handleBlur}
        >
          <CalendarIcon />
          {empty ? <span>{placeholder}</span> : formatValue(value)}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0">
          <Calendar
            mode="single"
            onSelect={(next) => field.handleChange(next)}
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
