import { describe, expect, it } from "vitest"
import { z } from "zod"
import {
  FieldValidationError,
  toActionError,
  toFieldName,
} from "./action-result.ts"

describe("toFieldName", () => {
  it("joins keys with dots and brackets array indices", () => {
    expect(toFieldName(["owners", 0, "percentage"])).toBe(
      "owners[0].percentage"
    )
    expect(toFieldName(["address", "city"])).toBe("address.city")
    expect(toFieldName(["matrix", 1, 2])).toBe("matrix[1][2]")
    expect(toFieldName([0, "name"])).toBe("[0].name")
  })

  it("reads Standard Schema path segment objects", () => {
    expect(toFieldName([{ key: "owners" }, { key: 3 }])).toBe("owners[3]")
  })

  it("returns an empty name for a missing or empty path", () => {
    expect(toFieldName(undefined)).toBe("")
    expect(toFieldName([])).toBe("")
  })
})

describe("toActionError", () => {
  it("groups a Zod failure by field name and keeps path-less issues form-level", () => {
    const schema = z
      .object({
        address: z.object({ city: z.string().min(1, "City required") }),
        owners: z.array(
          z.object({ percentage: z.number().max(100, "At most 100") })
        ),
      })
      .refine(() => false, "Rejected as a whole")
    const result = schema.safeParse({
      address: { city: "" },
      owners: [{ percentage: 10 }, { percentage: 120 }],
    })
    if (result.success) {
      throw new Error("expected a failure")
    }

    expect(toActionError(result.error.issues)).toEqual({
      fieldErrors: {
        "address.city": ["City required"],
        "owners[1].percentage": ["At most 100"],
      },
      formErrors: ["Rejected as a whole"],
    })
  })

  it("collects several messages for one field in order", () => {
    expect(
      toActionError([
        { message: "Too short", path: ["password"] },
        { message: "Needs a digit", path: ["password"] },
        { message: "Try again later" },
      ])
    ).toEqual({
      fieldErrors: { password: ["Too short", "Needs a digit"] },
      formErrors: ["Try again later"],
    })
  })
})

describe("FieldValidationError", () => {
  it("normalises single messages to arrays", () => {
    const error = new FieldValidationError(
      { email: "Taken", "owners[0].name": ["A", "B"] },
      { formErrors: "Locked" }
    )

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe("FieldValidationError")
    expect(error.toActionError()).toEqual({
      fieldErrors: { email: ["Taken"], "owners[0].name": ["A", "B"] },
      formErrors: ["Locked"],
    })
  })

  it("defaults to no form errors", () => {
    expect(new FieldValidationError({ email: "Taken" }).formErrors).toEqual([])
  })
})
