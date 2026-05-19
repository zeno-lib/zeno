"use client"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@zeno-lib/ui/field"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@zeno-lib/ui/input-otp"
import type { ReactNode } from "react"

import { describedBy } from "../lib/aria"
import { useFieldContext } from "../lib/contexts"
import { RequiredIndicator } from "../lib/required-indicator"
import {
  useHideFieldErrors,
  useIsFieldRequired,
  useIsInvalid,
} from "../lib/use-is-invalid"

// Flat surface — `OTPInput`'s prop type is a discriminated union over
// `render`/`children`, which doesn't compose cleanly with `Omit`. Listing the
// knobs we forward keeps the field's typing flat and predictable.
type OtpFieldProps = {
  description?: ReactNode
  label?: ReactNode
  /** Number of digits/characters in the code. Defaults to 6. */
  maxLength?: number
  /** Regex applied to each keystroke (e.g. `^[0-9]+$` for digits-only). */
  pattern?: string
  autoFocus?: boolean
  disabled?: boolean
  className?: string
  containerClassName?: string
  /**
   * Custom slot rendering. Overrides the default single-group layout when
   * you need a separator between segments.
   */
  children?: ReactNode
  /** Force the required `*` indicator on or off. Defaults to schema-derived. */
  required?: boolean
}

function OtpField({
  autoFocus,
  children,
  className,
  containerClassName,
  description,
  disabled,
  label,
  maxLength = 6,
  pattern,
  required,
}: OtpFieldProps) {
  const field = useFieldContext<string>()
  const errorId = `${field.name}-error`
  const descriptionId = `${field.name}-description`
  const isInvalid = useIsInvalid(field)
  const hideErrors = useHideFieldErrors(field)
  const showError = isInvalid && !hideErrors
  const schemaRequired = useIsFieldRequired(field)
  const isRequired = required ?? schemaRequired

  return (
    <Field data-invalid={isInvalid}>
      {label && (
        <FieldLabel htmlFor={field.name}>
          {label}
          {isRequired && <RequiredIndicator />}
        </FieldLabel>
      )}
      <InputOTP
        aria-describedby={describedBy(
          [description, descriptionId],
          [showError, errorId]
        )}
        aria-invalid={isInvalid || undefined}
        autoFocus={autoFocus}
        className={className}
        containerClassName={containerClassName}
        disabled={disabled}
        id={field.name}
        maxLength={maxLength}
        name={field.name}
        onBlur={field.handleBlur}
        onChange={(value) => field.handleChange(value)}
        pattern={pattern}
        value={field.state.value ?? ""}
      >
        {children ?? (
          <InputOTPGroup>
            {Array.from({ length: maxLength }, (_, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: OTP slots are a fixed-length ordered list — index *is* the stable identity.
              <InputOTPSlot index={index} key={index} />
            ))}
          </InputOTPGroup>
        )}
      </InputOTP>
      {description && (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      )}
      {showError && (
        <FieldError errors={field.state.meta.errors} id={errorId} />
      )}
    </Field>
  )
}

export type { OtpFieldProps }
export { OtpField }
