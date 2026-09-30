import { describe, expect, test } from "vitest"
import {
  formatNumber,
  getNumberSeparators,
  mapCaret,
  parseLocaleNumber,
  parseTypedNumber,
  roundTo,
} from "./formatted-number"

// Swiss grouping is an apostrophe, but which one (’ or ') depends on the
// runtime's CLDR data, so derive it instead of hard-coding it.
const CH = getNumberSeparators("de-CH").group
const ch = (text: string) => text.replaceAll("’", CH)

describe("getNumberSeparators", () => {
  test("reads the locale's separators", () => {
    expect(getNumberSeparators("de-CH").decimal).toBe(".")
    expect(["’", "'"]).toContain(CH)
    expect(getNumberSeparators("de-DE")).toEqual({ decimal: ",", group: "." })
    expect(getNumberSeparators("en-US")).toEqual({ decimal: ".", group: "," })
  })
})

describe("formatNumber", () => {
  test("groups thousands per locale", () => {
    const options = { maximumFractionDigits: 2 }
    expect(formatNumber(1_234_567.5, { ...options, locale: "de-CH" })).toBe(
      ch("1’234’567.5")
    )
    expect(formatNumber(1_234_567.5, { ...options, locale: "de-DE" })).toBe(
      "1.234.567,5"
    )
  })

  test("pads with minimumFractionDigits, uses an ASCII minus, empties null", () => {
    expect(
      formatNumber(-12.5, {
        locale: "de-CH",
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      })
    ).toBe("-12.50")
    expect(formatNumber(null, { maximumFractionDigits: 2 })).toBe("")
    expect(formatNumber(Number.NaN, { maximumFractionDigits: 2 })).toBe("")
  })

  test("can skip grouping", () => {
    expect(
      formatNumber(2024, {
        locale: "de-CH",
        maximumFractionDigits: 0,
        useGrouping: false,
      })
    ).toBe("2024")
  })
})

describe("parseTypedNumber", () => {
  const chf = { locale: "de-CH", maximumFractionDigits: 2 }

  test("re-inserts group separators while typing", () => {
    expect(parseTypedNumber("1234567", chf)).toEqual({
      text: ch("1’234’567"),
      value: 1_234_567,
    })
    expect(parseTypedNumber(ch("1’2345"), chf)).toEqual({
      text: ch("12’345"),
      value: 12_345,
    })
  })

  test("keeps a trailing decimal separator and truncates extra fraction digits", () => {
    expect(parseTypedNumber("12.", chf)).toEqual({ text: "12.", value: 12 })
    expect(parseTypedNumber("12.345", chf)).toEqual({
      text: "12.34",
      value: 12.34,
    })
    expect(parseTypedNumber(".5", chf)).toEqual({ text: "0.5", value: 0.5 })
  })

  test("uses the locale's decimal separator only", () => {
    const eur = { locale: "de-DE", maximumFractionDigits: 2 }
    expect(parseTypedNumber("1.2345", eur)).toEqual({
      text: "12.345",
      value: 12_345,
    })
    expect(parseTypedNumber("12,5", eur)).toEqual({ text: "12,5", value: 12.5 })
  })

  test("handles empties, minus and leading zeros", () => {
    expect(parseTypedNumber("", chf)).toEqual({ text: "", value: null })
    expect(parseTypedNumber("abc", chf)).toEqual({ text: "", value: null })
    expect(parseTypedNumber("-", chf)).toEqual({ text: "-", value: null })
    expect(parseTypedNumber("-12", chf)).toEqual({ text: "-12", value: -12 })
    expect(parseTypedNumber("-12", { ...chf, allowNegative: false })).toEqual({
      text: "12",
      value: 12,
    })
    expect(parseTypedNumber("007", chf)).toEqual({ text: "7", value: 7 })
  })

  test("integers only and a digit cap", () => {
    expect(
      parseTypedNumber("20245", {
        maxIntegerDigits: 4,
        maximumFractionDigits: 0,
        useGrouping: false,
      })
    ).toEqual({ text: "2024", value: 2024 })
    expect(
      parseTypedNumber("12.5", { locale: "de-CH", maximumFractionDigits: 0 })
    ).toEqual({ text: "125", value: 125 })
  })
})

describe("parseLocaleNumber", () => {
  test.each([
    ["CHF 1'234.50", "de-CH", 1234.5],
    ["1’234’567", "de-CH", 1_234_567],
    ["1.234,50 €", "de-CH", 1234.5],
    ["1,234.50", "de-DE", 1234.5],
    ["1,234", "de-CH", 1234],
    ["1,5", "de-CH", 1.5],
    ["1.234", "de-DE", 1234],
    ["1.5", "de-DE", 1.5],
    ["1 234 567,89", "fr-FR", 1_234_567.89],
    ["−42", "en-US", -42],
    ["(42.10)", "en-US", -42.1],
    ["1.234.567", "en-US", 1_234_567],
  ])("%s (%s) → %d", (text, locale, expected) => {
    expect(parseLocaleNumber(text, locale)).toBe(expected)
  })

  test("returns null without digits", () => {
    expect(parseLocaleNumber("CHF", "de-CH")).toBeNull()
    expect(parseLocaleNumber("", "de-CH")).toBeNull()
  })
})

describe("mapCaret", () => {
  test("keeps the caret after the same digit once separators move", () => {
    // Typed "5" after "1234" with the caret at the end: "12345" → "12’345".
    expect(mapCaret("12345", 5, ch("12’345"), "de-CH")).toBe(6)
    // Caret after the "2" of "1’2|34": same digit in "1’234" is index 3.
    expect(mapCaret(ch("1’234"), 3, ch("1’234"), "de-CH")).toBe(3)
    expect(mapCaret("", 0, "", "de-CH")).toBe(0)
  })
})

describe("roundTo", () => {
  test("rounds half away from zero without float drift", () => {
    expect(roundTo(1.005, 2)).toBe(1.01)
    expect(roundTo(-1.005, 2)).toBe(-1.01)
    expect(roundTo(0.07 * 100, 2)).toBe(7)
  })
})
