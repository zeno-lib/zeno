import { describe, expect, it } from "vitest"
import { formatChange } from "./agent-tools.ts"

describe("formatChange", () => {
  it("keeps a value's newlines from faking a line of the approval", () => {
    expect(
      formatChange({
        changes: [{ field: "title", from: null, to: "A\nstatus: same" }],
        entity: "Post 7\n(no field changes)",
      })
    ).toBe('Post 7 (no field changes)\ntitle: (empty) → "A\\nstatus: same"')
  })

  it("escapes the line separators and bidi overrides JSON leaves raw", () => {
    expect(
      formatChange({
        changes: [{ field: "ti\u2028tle", from: "a\u2028b", to: "c\u202ed" }],
        entity: "Post\u202e 7",
      })
    ).toBe('Post  7\nti tle: "a\\u2028b" → "c\\u202ed"')
  })
})
