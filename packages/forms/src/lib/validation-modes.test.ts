import type { AnyFormApi } from "@tanstack/react-form"
import { describe, expect, test } from "@zeno-lib/test"
import {
  DEFAULT_VALIDATION_MODE,
  getFormHideFieldErrors,
  getFormValidationMode,
  isFieldRequired,
  setFormZenoState,
} from "./validation-modes"

function makeFormStub() {
  return { store: {} } as unknown as AnyFormApi
}

describe("validation-modes WeakMap state", () => {
  test("default mode is 'blur-then-change'", () => {
    expect(DEFAULT_VALIDATION_MODE).toBe("blur-then-change")
  })

  test("unset form returns default state", () => {
    const form = makeFormStub()
    expect(getFormValidationMode(form)).toBe("blur-then-change")
    expect(getFormHideFieldErrors(form)).toBe(false)
    expect(isFieldRequired(form, "email")).toBe(false)
  })

  test("setFormZenoState merges partial updates onto current state", () => {
    const form = makeFormStub()
    setFormZenoState(form, { validation: "submit" })
    expect(getFormValidationMode(form)).toBe("submit")
    expect(getFormHideFieldErrors(form)).toBe(false)

    setFormZenoState(form, { hideFieldErrors: true })
    // first partial preserved
    expect(getFormValidationMode(form)).toBe("submit")
    expect(getFormHideFieldErrors(form)).toBe(true)
  })

  test("isFieldRequired honours requiredIndicator flag", () => {
    const form = makeFormStub()
    setFormZenoState(form, {
      requiredFields: new Set(["email"]),
      requiredIndicator: true,
    })
    expect(isFieldRequired(form, "email")).toBe(true)
    expect(isFieldRequired(form, "password")).toBe(false)

    setFormZenoState(form, { requiredIndicator: false })
    expect(isFieldRequired(form, "email")).toBe(false)
  })

  test("two forms keyed on different store references are independent", () => {
    const a = makeFormStub()
    const b = makeFormStub()
    setFormZenoState(a, { validation: "change" })
    setFormZenoState(b, { validation: "submit" })
    expect(getFormValidationMode(a)).toBe("change")
    expect(getFormValidationMode(b)).toBe("submit")
  })

  test("state is keyed on store, not the form object identity", () => {
    const store = {}
    const formA = { store } as unknown as AnyFormApi
    const formB = { extra: "spread", store } as unknown as AnyFormApi
    setFormZenoState(formA, { validation: "change" })
    // Both reach the same WeakMap entry because they share `store` — this
    // mirrors how TanStack's `useForm` spread differs from the FormApi seen
    // by child fields.
    expect(getFormValidationMode(formB)).toBe("change")
  })
})
