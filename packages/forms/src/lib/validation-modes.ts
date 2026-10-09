"use client"

import type { AnyFormApi } from "@tanstack/react-form"

import { toRequiredPathKey } from "./schema-required"

type ValidationMode = "change" | "blur" | "submit" | "blur-then-change"

const DEFAULT_VALIDATION_MODE: ValidationMode = "blur-then-change"

type ZenoFormState = {
  validation: ValidationMode
  hideFieldErrors: boolean
  requiredIndicator: boolean
  requiredFields: ReadonlySet<string>
}

const EMPTY_REQUIRED_FIELDS: ReadonlySet<string> = new Set<string>()

const DEFAULT_FORM_STATE: ZenoFormState = {
  hideFieldErrors: false,
  requiredFields: EMPTY_REQUIRED_FIELDS,
  requiredIndicator: true,
  validation: DEFAULT_VALIDATION_MODE,
}

// Per-form Zeno-specific state. Keyed by `form.store` rather than the form
// object: TanStack Form's `useForm` returns a spread `{ ...formApi, ... }`
// whose identity differs from the underlying `formApi` that fields receive
// via `field.form`. The `store` instance is set in the FormApi constructor
// and survives the spread, so it's the only reference shared by both the
// caller of `useForm` and every child field.
const formZenoState = new WeakMap<object, ZenoFormState>()

function stateKey(form: AnyFormApi): object {
  return (form as { store: object }).store
}

function setFormZenoState(
  form: AnyFormApi,
  state: Partial<ZenoFormState>
): void {
  const key = stateKey(form)
  const current = formZenoState.get(key) ?? DEFAULT_FORM_STATE
  formZenoState.set(key, { ...current, ...state })
}

function getFormZenoState(form: AnyFormApi): ZenoFormState {
  return formZenoState.get(stateKey(form)) ?? DEFAULT_FORM_STATE
}

function getFormValidationMode(form: AnyFormApi): ValidationMode {
  return getFormZenoState(form).validation
}

function getFormHideFieldErrors(form: AnyFormApi): boolean {
  return getFormZenoState(form).hideFieldErrors
}

// Whether the schema requires the field, whatever `requiredIndicator` says.
function isFieldRequiredBySchema(form: AnyFormApi, name: string): boolean {
  return getFormZenoState(form).requiredFields.has(toRequiredPathKey(name))
}

function isFieldRequired(form: AnyFormApi, name: string): boolean {
  return (
    getFormZenoState(form).requiredIndicator &&
    isFieldRequiredBySchema(form, name)
  )
}

export {
  DEFAULT_VALIDATION_MODE,
  getFormHideFieldErrors,
  getFormValidationMode,
  isFieldRequired,
  isFieldRequiredBySchema,
  setFormZenoState,
  type ValidationMode,
}
