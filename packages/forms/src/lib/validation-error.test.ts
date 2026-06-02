import { describe, expect, test } from "@zeno-lib/test"

import { ValidationError } from "./validation-error"

describe("ValidationError", () => {
  test("extends Error and sets name", () => {
    const err = new ValidationError({ email: "Taken" })
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe("ValidationError")
  })

  test("default message is 'Validation failed'", () => {
    const err = new ValidationError({ email: "Taken" })
    expect(err.message).toBe("Validation failed")
  })

  test("custom message via options.message", () => {
    const err = new ValidationError({ email: "Taken" }, { message: "Boom" })
    expect(err.message).toBe("Boom")
  })

  test("exposes fields and formError", () => {
    const err = new ValidationError(
      { email: "Taken", name: ["A", "B"] },
      { formError: "Server down" }
    )
    expect(err.fields).toEqual({ email: "Taken", name: ["A", "B"] })
    expect(err.formError).toBe("Server down")
  })

  test("formError is undefined when not provided", () => {
    const err = new ValidationError({ email: "Taken" })
    expect(err.formError).toBeUndefined()
  })

  test("accepts readonly array of messages for a field", () => {
    const messages = ["too short", "missing digit"] as const
    const err = new ValidationError({ password: messages })
    expect(err.fields.password).toEqual(messages)
  })
})
