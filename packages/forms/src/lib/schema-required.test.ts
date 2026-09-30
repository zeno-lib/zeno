import { describe, expect, test } from "vitest"
import { z } from "zod"

import {
  getRequiredPaths,
  type StandardSchemaLike,
  toRequiredPathKey,
} from "./schema-required"

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

  test("nested z.object reports the parent and its required children", () => {
    const schema = z.object({
      profile: z.object({
        bio: z.string().optional(),
        email: z.email(),
      }),
    })
    const required = getRequiredPaths(schema)
    expect(required.has("profile")).toBe(true)
    expect(required.has("profile.email")).toBe(true)
    expect(required.has("profile.bio")).toBe(false)
  })

  test("optional nested object is not descended into", () => {
    const schema = z.object({
      profile: z.object({ email: z.email() }).optional(),
    })
    expect(getRequiredPaths(schema).size).toBe(0)
  })

  test("array rows are reported with TanStack bracket syntax", () => {
    const schema = z.object({
      members: z.array(
        z.object({
          name: z.string().min(1),
          note: z.string().optional(),
        })
      ),
      tags: z.array(z.string()),
    })
    const required = getRequiredPaths(schema)
    expect(required.has("members")).toBe(true)
    expect(required.has("members[0].name")).toBe(true)
    expect(required.has("members.0.name")).toBe(false)
    expect(required.has("members[0].note")).toBe(false)
    expect(required.has("tags[0]")).toBe(true)
  })

  test("nested arrays descend through every level", () => {
    const schema = z.object({
      groups: z.array(
        z.object({ members: z.array(z.object({ name: z.string() })) })
      ),
    })
    const required = getRequiredPaths(schema)
    expect(required.has("groups[0].members[0].name")).toBe(true)
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

  test("numeric path segments render as bracket indices, normalised to 0", () => {
    const schema: StandardSchemaLike = {
      "~standard": {
        validate: () => ({
          issues: [
            { path: ["members", 2, "name"] },
            { path: ["rows", "1", "value"] },
            { path: [{ key: "items" }, { key: 3 }] },
          ],
        }),
      },
    }
    const required = getRequiredPaths(schema)
    expect(required.has("members[0].name")).toBe(true)
    expect(required.has("rows[0].value")).toBe(true)
    expect(required.has("items[0]")).toBe(true)
  })

  test("Valibot-style capitalised `expected` hints are descended", () => {
    const schema: StandardSchemaLike = {
      "~standard": {
        validate: (value) => {
          const profile = (value as { profile?: unknown }).profile
          return profile === undefined
            ? { issues: [{ expected: "Object", path: [{ key: "profile" }] }] }
            : {
                issues: [
                  {
                    expected: "string",
                    path: [{ key: "profile" }, { key: "email" }],
                  },
                ],
              }
        },
      },
    }
    const required = getRequiredPaths(schema)
    expect(required.has("profile")).toBe(true)
    expect(required.has("profile.email")).toBe(true)
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

describe("toRequiredPathKey", () => {
  test("normalises bracket and dotted indices to [0]", () => {
    expect(toRequiredPathKey("members[3].name")).toBe("members[0].name")
    expect(toRequiredPathKey("members.3.name")).toBe("members[0].name")
    expect(toRequiredPathKey("groups[1].members[12]")).toBe(
      "groups[0].members[0]"
    )
    expect(toRequiredPathKey("email")).toBe("email")
    expect(toRequiredPathKey("line2")).toBe("line2")
  })
})
