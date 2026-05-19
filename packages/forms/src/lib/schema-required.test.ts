import { describe, expect, test } from "@zeno-lib/vitest"
import { z } from "zod"

import { getRequiredPaths, type StandardSchemaLike } from "./schema-required"

describe("getRequiredPaths", () => {
  test("plain required fields appear in the set", () => {
    const schema = z.object({
      email: z.email(),
      name: z.string().min(1),
    })
    const required = getRequiredPaths(schema)
    expect(required.has("email")).toBe(true)
    expect(required.has("name")).toBe(true)
  })

  test(".optional() fields do not appear", () => {
    const schema = z.object({
      email: z.email(),
      nickname: z.string().optional(),
    })
    const required = getRequiredPaths(schema)
    expect(required.has("email")).toBe(true)
    expect(required.has("nickname")).toBe(false)
  })

  test(".default(...) fields do not appear", () => {
    const schema = z.object({
      email: z.email(),
      role: z.string().default("member"),
    })
    const required = getRequiredPaths(schema)
    expect(required.has("email")).toBe(true)
    expect(required.has("role")).toBe(false)
  })

  test("nested z.object reports the top-level key when missing", () => {
    // Probing with `{}` only reveals the top-level required key; Zod never
    // recurses past a missing parent.
    const schema = z.object({
      profile: z.object({
        email: z.email(),
      }),
    })
    const required = getRequiredPaths(schema)
    expect(required.has("profile")).toBe(true)
    expect(required.has("profile.email")).toBe(false)
  })

  test("dot-joined path is built when issues carry multi-segment paths", () => {
    // Whether Zod surfaces nested paths depends on schema shape (defaults,
    // refine targets, etc.). We exercise the path-joining itself via a
    // stand-in schema that emits a multi-segment issue path.
    const schema = {
      "~standard": {
        validate: () => ({
          issues: [{ path: ["profile", "email"] }],
        }),
      },
    }
    const required = getRequiredPaths(schema)
    expect(required.has("profile.email")).toBe(true)
  })

  test(".refine() cross-field issues are tolerated (do not crash)", () => {
    const schema = z
      .object({
        confirm: z.string().min(8),
        password: z.string().min(8),
      })
      .refine((value) => value.password === value.confirm, {
        message: "Passwords must match",
        path: ["confirm"],
      })
    expect(() => getRequiredPaths(schema)).not.toThrow()
  })

  test("async schema returns empty set", () => {
    const asyncSchema: StandardSchemaLike = {
      "~standard": {
        validate: (_: unknown) =>
          Promise.resolve({ value: undefined } as { value: unknown }),
      },
    }
    expect(getRequiredPaths(asyncSchema).size).toBe(0)
  })

  test("throwing schema returns empty set", () => {
    const throwing: StandardSchemaLike = {
      "~standard": {
        validate: () => {
          throw new Error("boom")
        },
      },
    }
    expect(getRequiredPaths(throwing).size).toBe(0)
  })

  test("schema returning no issues returns empty set", () => {
    const empty: StandardSchemaLike = {
      "~standard": {
        validate: () => ({ value: undefined }),
      },
    }
    expect(getRequiredPaths(empty).size).toBe(0)
  })

  test("path entries shaped like { key } (Valibot) are normalised", () => {
    const valibotStyle: StandardSchemaLike = {
      "~standard": {
        validate: () => ({
          issues: [
            { path: [{ key: "profile" }, { key: "email" }] },
            { path: ["plain"] },
          ],
        }),
      },
    }
    const required = getRequiredPaths(valibotStyle)
    expect(required.has("profile.email")).toBe(true)
    expect(required.has("plain")).toBe(true)
  })

  test("issues with empty path are skipped (form-level only)", () => {
    const formLevelOnly: StandardSchemaLike = {
      "~standard": {
        validate: () => ({ issues: [{ path: [] }] }),
      },
    }
    expect(getRequiredPaths(formLevelOnly).size).toBe(0)
  })
})
