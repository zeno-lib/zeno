import { describe, expect, test } from "vitest"
import { z } from "zod"

import { emptyValueFor, withEmptyStartValues } from "./empty-value"
import { extractZodDefaults } from "./schema-defaults"

const FALLBACK = Symbol("fallback")

function cleared(field: z.ZodType, name = "field", values: unknown = {}) {
  return emptyValueFor(z.object({ field }), values, name, FALLBACK)
}

describe("emptyValueFor", () => {
  test("null, then undefined, then the type's own empty value", () => {
    expect(cleared(z.string().nullable())).toBeNull()
    expect(cleared(z.string().optional())).toBeUndefined()
    expect(cleared(z.string())).toBe("")
    expect(cleared(z.array(z.string()))).toEqual([])
    expect(cleared(z.uuid().nullable())).toBeNull()
    expect(cleared(z.enum(["a", "b"]).optional())).toBeUndefined()
    expect(cleared(z.number().nullable())).toBeNull()
    expect(cleared(z.date().nullish())).toBeNull()
  })

  test("a field that accepts no empty value keeps the field's own fallback", () => {
    expect(cleared(z.string().min(1))).toBe(FALLBACK)
    expect(cleared(z.number())).toBe(FALLBACK)
  })

  test("array rows follow the row schema", () => {
    const schema = z.object({
      members: z.array(
        z.object({
          id: z.uuid().nullable(),
          name: z.string(),
          note: z.string().optional(),
        })
      ),
    })
    const values = { members: [{ id: "x" }, { id: "y" }] }
    const at = (name: string) => emptyValueFor(schema, values, name, FALLBACK)
    expect(at("members[1].id")).toBeNull()
    expect(at("members[1].name")).toBe("")
    expect(at("members[1].note")).toBeUndefined()
  })

  test("without a schema, or with an async one, the fallback stands", () => {
    expect(emptyValueFor(undefined, {}, "field", FALLBACK)).toBe(FALLBACK)
    const asyncSchema = z.object({
      field: z.string().refine(async () => true),
    })
    expect(emptyValueFor(asyncSchema, {}, "field", FALLBACK)).toBe(FALLBACK)
  })
})

describe("withEmptyStartValues", () => {
  test('starts a field whose schema rejects `""` at its empty value', () => {
    const schema = z.object({
      email: z.email().optional(),
      name: z.string().min(1),
      note: z.string(),
      ownerId: z.uuid().nullable(),
    })
    const start = withEmptyStartValues(schema, extractZodDefaults(schema))
    expect(start).toEqual({
      email: undefined,
      name: "",
      note: "",
      ownerId: null,
    })
  })
})
