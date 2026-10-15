import { describe, expect, test } from "vitest"
import { formatIsoDate, parseDateValue } from "./date-value"

describe("parseDateValue", () => {
  test("reads a day the month doesn't have as empty, not as next month's", () => {
    expect(parseDateValue("2026-02-31")).toBeUndefined()
  })

  test("keeps a year below 100, which `new Date(y, m, d)` reads as 19yy", () => {
    const date = parseDateValue("0042-03-01")
    expect(date?.getFullYear()).toBe(42)
    expect(date && formatIsoDate(date)).toBe("0042-03-01")
  })
})
