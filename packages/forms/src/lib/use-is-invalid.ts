"use client"

import { type AnyFieldApi, useSelector } from "@tanstack/react-form"

import {
  getFormHideFieldErrors,
  getFormValidationMode,
  isFieldRequired,
  type ValidationMode,
} from "./validation-modes"

type ErrorSourceMap = Record<string, "field" | "form" | undefined>

const FIELD_LEVEL_CAUSES = ["onChange", "onBlur", "onSubmit"] as const

// Has the user explicitly opted into a `validators={{ onChange | onBlur |
// onSubmit }}` cause on this field? If yes, we honour the cause directly —
// the form's `validators` mode does not gate per-field validators (a user
// who wrote `onChange` expects live feedback, even if the form is in
// `blur-then-change` mode).
function hasFieldLevelError(
  errorMap: Record<string, unknown> | undefined,
  errorSourceMap: ErrorSourceMap | undefined,
  cause: (typeof FIELD_LEVEL_CAUSES)[number]
): boolean {
  if (!(errorMap && errorSourceMap)) {
    return false
  }
  return errorSourceMap[cause] === "field" && errorMap[cause] !== undefined
}

function modeAllowsDisplay(
  mode: ValidationMode,
  isDirty: boolean,
  isBlurred: boolean,
  wasSubmitted: boolean
): boolean {
  if (mode === "change") {
    return isDirty || wasSubmitted
  }
  if (mode === "submit") {
    return wasSubmitted
  }
  // 'blur' and 'blur-then-change'
  return isBlurred || wasSubmitted
}

// Returns the "should we display errors?" gate for a field. The gate matches
// the form's `validators` mode (set via `useForm({ validators })`):
//
//   - `change`           → show as soon as the user has typed (live)
//   - `blur`             → show after first blur
//   - `submit`           → show after first submit attempt
//   - `blur-then-change` → show after first blur (default)
//
// All modes also show errors after a submit attempt, so a user who clicks
// submit without ever interacting with required fields still sees them.
//
// Per-field validators bypass the form's mode entirely: an error written by
// `validators={{ onChange }}` shows live (after first keystroke) regardless
// of the form's gating, because the user explicitly opted into that cause.
function useIsInvalid(field: AnyFieldApi): boolean {
  const wasSubmitted = useSelector(
    field.form.store,
    (state) => state.submissionAttempts > 0
  )

  if (field.state.meta.isValid) {
    return false
  }

  const { isDirty, isBlurred, errorMap, errorSourceMap } = field.state.meta
  const sourceMap = errorSourceMap as ErrorSourceMap | undefined

  if (hasFieldLevelError(errorMap, sourceMap, "onChange")) {
    return isDirty || wasSubmitted
  }
  if (hasFieldLevelError(errorMap, sourceMap, "onBlur")) {
    return isBlurred || wasSubmitted
  }
  if (hasFieldLevelError(errorMap, sourceMap, "onSubmit")) {
    return wasSubmitted
  }

  return modeAllowsDisplay(
    getFormValidationMode(field.form),
    isDirty,
    isBlurred,
    wasSubmitted
  )
}

// Returns whether the form was configured to hide inline field errors via
// `useForm({ hideFieldErrors: true })`. The shipped fields read this to
// skip rendering their inline `<FieldError>` while still flipping
// `data-invalid` / `aria-invalid` for invalid styling.
function useHideFieldErrors(field: AnyFieldApi): boolean {
  return getFormHideFieldErrors(field.form)
}

// Returns whether the form's schema marks this field as required. Drives the
// inline `*` indicator next to field labels. Returns `false` when the form
// has no schema, was constructed with `requiredIndicator: false`, or the
// schema doesn't mark this field's path as required.
function useIsFieldRequired(field: AnyFieldApi): boolean {
  return isFieldRequired(field.form, field.name)
}

export { useHideFieldErrors, useIsFieldRequired, useIsInvalid }
