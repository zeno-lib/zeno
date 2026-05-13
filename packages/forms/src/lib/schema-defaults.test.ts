import { describe, expect, test } from "@zeno/vitest"
import { z } from "zod"

import { deepMergeDefaults, extractZodDefaults } from "./schema-defaults"

describe("extractZodDefaults — primitives", () => {
  test("z.string() → ''", () => {
    expect(extractZodDefaults(z.object({ x: z.string() }))).toEqual({ x: "" })
  })

  test("z.email() / z.url() / z.uuid() → ''", () => {
    const schema = z.object({
      email: z.email(),
      id: z.uuid(),
      url: z.url(),
    })
    expect(extractZodDefaults(schema)).toEqual({ email: "", id: "", url: "" })
  })

  test("z.array(...) → []", () => {
    expect(extractZodDefaults(z.object({ tags: z.array(z.string()) }))).toEqual(
      { tags: [] }
    )
  })

  test("z.number() / z.boolean() / z.date() are skipped", () => {
    const schema = z.object({
      active: z.boolean(),
      age: z.number(),
      created: z.date(),
    })
    expect(extractZodDefaults(schema)).toEqual({})
  })

  test("z.enum / z.literal are skipped", () => {
    const schema = z.object({
      kind: z.literal("a"),
      role: z.enum(["admin", "user"]),
    })
    expect(extractZodDefaults(schema)).toEqual({})
  })
})

describe("extractZodDefaults — wrappers", () => {
  test(".default(value) flows through", () => {
    const schema = z.object({
      n: z.number().default(7),
      role: z.string().default("member"),
    })
    expect(extractZodDefaults(schema)).toEqual({ n: 7, role: "member" })
  })

  test(".prefault(value) flows through", () => {
    const schema = z.object({
      role: z.prefault(z.string(), "guest"),
    })
    expect(extractZodDefaults(schema)).toEqual({ role: "guest" })
  })

  test(".optional() unwraps to inner string → ''", () => {
    const schema = z.object({ x: z.string().optional() })
    expect(extractZodDefaults(schema)).toEqual({ x: "" })
  })

  test(".nullable() unwraps to inner string → ''", () => {
    const schema = z.object({ x: z.string().nullable() })
    expect(extractZodDefaults(schema)).toEqual({ x: "" })
  })

  test(".readonly() unwraps to inner string → ''", () => {
    const schema = z.object({ x: z.string().readonly() })
    expect(extractZodDefaults(schema)).toEqual({ x: "" })
  })

  test("z.pipe uses the in side", () => {
    const schema = z.object({
      n: z.string().pipe(z.coerce.number()),
    })
    // The `in` side is z.string() → ''
    expect(extractZodDefaults(schema)).toEqual({ n: "" })
  })

  test(".optional() over a number is skipped", () => {
    const schema = z.object({ x: z.number().optional() })
    expect(extractZodDefaults(schema)).toEqual({})
  })
})

describe("extractZodDefaults — nested objects", () => {
  test("nested z.object recurses", () => {
    const schema = z.object({
      profile: z.object({
        email: z.email(),
        nick: z.string(),
      }),
    })
    expect(extractZodDefaults(schema)).toEqual({
      profile: { email: "", nick: "" },
    })
  })

  test("empty nested object is skipped", () => {
    const schema = z.object({
      meta: z.object({
        active: z.boolean(),
        age: z.number(),
      }),
    })
    expect(extractZodDefaults(schema)).toEqual({})
  })

  test("partial nested object produced when at least one leaf survives", () => {
    const schema = z.object({
      profile: z.object({
        age: z.number(),
        name: z.string(),
      }),
    })
    expect(extractZodDefaults(schema)).toEqual({ profile: { name: "" } })
  })
})

describe("extractZodDefaults — degrades safely", () => {
  test("non-object root returns {}", () => {
    expect(extractZodDefaults(z.string() as never)).toEqual({})
  })

  test("non-Zod schema returns {}", () => {
    expect(
      extractZodDefaults({} as Parameters<typeof extractZodDefaults>[0])
    ).toEqual({})
  })

  test("MAX_WRAPPER_DEPTH=16 does not loop on adversarial chains", () => {
    // Build a cyclic wrapper chain (innerType points back at itself).
    const cyclic: { _zod: { def: unknown } } = {
      _zod: { def: { innerType: null as unknown, type: "optional" } },
    }
    ;(cyclic._zod.def as { innerType: unknown }).innerType = cyclic
    const root = {
      _zod: { def: { shape: { x: cyclic }, type: "object" } },
    } as unknown as Parameters<typeof extractZodDefaults>[0]
    // Should bail out at MAX_WRAPPER_DEPTH and skip the field — not hang.
    expect(extractZodDefaults(root)).toEqual({})
  })
})

describe("deepMergeDefaults", () => {
  test("undefined user defaults returns schema defaults reference", () => {
    const schema = { a: 1, nested: { b: 2 } }
    expect(deepMergeDefaults(schema, undefined)).toBe(schema)
  })

  test("scalar user value wins over schema scalar", () => {
    expect(deepMergeDefaults({ a: 1, b: "x" }, { a: 5 })).toEqual({
      a: 5,
      b: "x",
    })
  })

  test("plain object on both sides recurses", () => {
    expect(
      deepMergeDefaults({ nested: { a: 1, b: 2 } }, { nested: { b: 99 } })
    ).toEqual({ nested: { a: 1, b: 99 } })
  })

  test("array is treated atomically (user replaces schema)", () => {
    expect(deepMergeDefaults({ tags: ["a", "b"] }, { tags: ["c"] })).toEqual({
      tags: ["c"],
    })
  })

  test("Date is treated atomically", () => {
    const schemaDate = new Date("2020-01-01")
    const userDate = new Date("2030-01-01")
    expect(deepMergeDefaults({ when: schemaDate }, { when: userDate })).toEqual(
      { when: userDate }
    )
  })

  test("user explicit undefined preserved (intentional reset)", () => {
    expect(deepMergeDefaults({ a: 1, b: 2 }, { a: undefined })).toEqual({
      a: undefined,
      b: 2,
    })
  })

  test("key only present in user value flows through", () => {
    expect(deepMergeDefaults({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })

  test("schema object + user scalar → user wins (no merge attempt)", () => {
    expect(deepMergeDefaults({ x: { a: 1 } }, { x: null })).toEqual({ x: null })
  })
})
