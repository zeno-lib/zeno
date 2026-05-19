import type { AnyFormApi } from "@tanstack/react-form"
import { describe, expect, test, vi } from "@zeno-lib/vitest"

import { applyValidationError } from "./apply-validation-error"
import { ValidationError } from "./validation-error"

type FieldMetaUpdater = (prev: {
  errorMap?: Record<string, unknown>
  errors?: unknown[]
}) => unknown

function makeFormStub() {
  const setFieldMeta = vi.fn(
    (_name: string, _updater: FieldMetaUpdater) => undefined
  )
  const setErrorMap = vi.fn((_map: unknown) => undefined)
  return {
    api: { setErrorMap, setFieldMeta } as unknown as AnyFormApi,
    setErrorMap,
    setFieldMeta,
  }
}

describe("applyValidationError", () => {
  test("writes single string message to errorMap.onChange and errors array", () => {
    const { api, setFieldMeta } = makeFormStub()
    applyValidationError(api, new ValidationError({ email: "Taken" }))
    expect(setFieldMeta).toHaveBeenCalledTimes(1)
    const [name, updater] = setFieldMeta.mock.calls[0] as [
      string,
      FieldMetaUpdater,
    ]
    expect(name).toBe("email")
    const next = updater({}) as {
      errors: { message: string }[]
      errorMap: { onChange: { message: string } }
      isValid: boolean
    }
    expect(next.errors).toEqual([{ message: "Taken" }])
    expect(next.errorMap.onChange).toEqual({ message: "Taken" })
    expect(next.isValid).toBe(false)
  })

  test("array of messages forwards all entries; errorMap.onChange gets first", () => {
    const { api, setFieldMeta } = makeFormStub()
    applyValidationError(
      api,
      new ValidationError({ password: ["short", "no digit"] })
    )
    const updater = setFieldMeta.mock.calls[0]?.[1] as FieldMetaUpdater
    const next = updater({}) as {
      errors: { message: string }[]
      errorMap: { onChange: { message: string } }
    }
    expect(next.errors).toEqual([{ message: "short" }, { message: "no digit" }])
    expect(next.errorMap.onChange).toEqual({ message: "short" })
  })

  test("preserves existing errorMap keys via spread", () => {
    const { api, setFieldMeta } = makeFormStub()
    applyValidationError(api, new ValidationError({ email: "Taken" }))
    const updater = setFieldMeta.mock.calls[0]?.[1] as FieldMetaUpdater
    const next = updater({ errorMap: { onBlur: { message: "Old" } } }) as {
      errorMap: { onBlur: { message: string }; onChange: { message: string } }
    }
    expect(next.errorMap.onBlur).toEqual({ message: "Old" })
    expect(next.errorMap.onChange).toEqual({ message: "Taken" })
  })

  test("formError populates form-level error map via setErrorMap", () => {
    const { api, setErrorMap } = makeFormStub()
    applyValidationError(
      api,
      new ValidationError({ email: "Taken" }, { formError: "Server down" })
    )
    expect(setErrorMap).toHaveBeenCalledWith({
      onSubmit: { fields: {}, form: "Server down" },
    })
  })

  test("no formError → setErrorMap not called", () => {
    const { api, setErrorMap } = makeFormStub()
    applyValidationError(api, new ValidationError({ email: "Taken" }))
    expect(setErrorMap).not.toHaveBeenCalled()
  })

  test("multiple fields → setFieldMeta called per field", () => {
    const { api, setFieldMeta } = makeFormStub()
    applyValidationError(
      api,
      new ValidationError({ email: "Taken", name: "Required" })
    )
    expect(setFieldMeta).toHaveBeenCalledTimes(2)
    const names = setFieldMeta.mock.calls.map((c) => c[0])
    expect(names).toEqual(expect.arrayContaining(["email", "name"]))
  })
})
