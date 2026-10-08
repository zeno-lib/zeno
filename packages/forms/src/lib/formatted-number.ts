// Pure, locale-aware helpers behind `useFormattedNumber` (and therefore the
// money / percentage / year fields). UI-free so they ship on npm and can be
// unit-tested without a DOM.
//
// Display strings always use ASCII digits and an ASCII `-` for negatives, with
// the locale's own group and decimal separators (e.g. `de-CH` → `1’234.5`,
// `de-DE` → `1.234,5`, `fr-FR` → `1 234,5`).

type NumberSeparators = {
  /** Thousands separator, e.g. `’` for `de-CH`, `,` for `en-US`. */
  group: string
  /** Decimal separator, e.g. `.` for `de-CH`, `,` for `de-DE`. */
  decimal: string
}

type FormatNumberOptions = {
  locale?: string
  /** Maximum digits after the decimal separator. `0` means integers only. */
  maximumFractionDigits: number
  /** Minimum digits after the decimal separator (pads with zeros). */
  minimumFractionDigits?: number
  /** Insert group (thousands) separators. Defaults to `true`. */
  useGrouping?: boolean
}

type TypedNumber = {
  /** The re-formatted text to show in the input. */
  text: string
  /** The parsed number, or `null` when the text holds no digits. */
  value: number | null
}

type ParseTypedOptions = {
  locale?: string
  maximumFractionDigits: number
  useGrouping?: boolean
  allowNegative?: boolean
  /** Drop integer digits beyond this count (e.g. `4` for a year). */
  maxIntegerDigits?: number
}

const separatorCache = new Map<string, NumberSeparators>()

// Minus signs a user may type or paste: ASCII hyphen-minus, U+2212 (what Intl
// emits for some locales), and the en dash.
const MINUS_SIGNS = /[-−–]/
const LEADING_MINUS = /^[^\d]*[-−–]/
const NON_DIGIT = /\D/g
const LEADING_ZEROS = /^0+(?=\d)/
const DIGIT = /\d/
const DIGITS = /\d/g
const PARENTHESIZED = /^\s*\(.*\)\s*$/
const NOT_NUMERIC = /[^\d.,]/g
const UNICODE_MINUS = /\u2212/g

function getNumberSeparators(locale?: string): NumberSeparators {
  const key = locale ?? ""
  const cached = separatorCache.get(key)
  if (cached) {
    return cached
  }
  const parts = new Intl.NumberFormat(locale, {
    numberingSystem: "latn",
  }).formatToParts(1_234_567.5)
  const separators = {
    decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
    group: parts.find((p) => p.type === "group")?.value ?? ",",
  }
  separatorCache.set(key, separators)
  return separators
}

function normalizeMinus(text: string): string {
  return text.replace(UNICODE_MINUS, "-")
}

/** Format a number for display (on blur, on reset, on first render). */
function formatNumber(
  value: number | null | undefined,
  {
    locale,
    maximumFractionDigits,
    minimumFractionDigits = 0,
    useGrouping = true,
  }: FormatNumberOptions
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return ""
  }
  return normalizeMinus(
    new Intl.NumberFormat(locale, {
      maximumFractionDigits,
      minimumFractionDigits: Math.min(
        minimumFractionDigits,
        maximumFractionDigits
      ),
      numberingSystem: "latn",
      useGrouping,
    }).format(value)
  )
}

function groupIntegerDigits(
  digits: string,
  locale: string | undefined,
  useGrouping: boolean
): string {
  if (!useGrouping || digits.length <= 3) {
    return digits
  }
  // BigInt keeps long digit strings exact while Intl inserts the separators.
  return new Intl.NumberFormat(locale, {
    numberingSystem: "latn",
    useGrouping: true,
  }).format(BigInt(digits))
}

function toNumber(
  negative: boolean,
  intDigits: string,
  fracDigits: string
): number | null {
  if (intDigits === "" && fracDigits === "") {
    return null
  }
  const value = Number(`${intDigits || "0"}.${fracDigits || "0"}`)
  return negative && value !== 0 ? -value : value
}

/**
 * Re-format what the user is typing. Only the locale's decimal separator
 * starts the fraction; every other non-digit is dropped and group separators
 * are re-inserted. Keeps a trailing decimal separator (`"12."`) so typing
 * isn't fought, and truncates fraction digits beyond `maximumFractionDigits`.
 */
function parseTypedNumber(
  raw: string,
  {
    locale,
    maximumFractionDigits,
    useGrouping = true,
    allowNegative = true,
    maxIntegerDigits,
  }: ParseTypedOptions
): TypedNumber {
  const { decimal } = getNumberSeparators(locale)
  const negative = allowNegative && LEADING_MINUS.test(raw)
  const decimalIndex = maximumFractionDigits > 0 ? raw.indexOf(decimal) : -1
  const intRaw = decimalIndex === -1 ? raw : raw.slice(0, decimalIndex)
  const fracRaw = decimalIndex === -1 ? "" : raw.slice(decimalIndex + 1)

  let intDigits = intRaw.replace(NON_DIGIT, "").replace(LEADING_ZEROS, "")
  if (maxIntegerDigits !== undefined) {
    intDigits = intDigits.slice(0, maxIntegerDigits)
  }
  const fracDigits = fracRaw
    .replace(NON_DIGIT, "")
    .slice(0, maximumFractionDigits)
  const hasDecimal = decimalIndex !== -1

  const sign = negative ? "-" : ""
  const intText =
    intDigits === "" && hasDecimal
      ? "0"
      : groupIntegerDigits(intDigits, locale, useGrouping)
  const text = `${sign}${intText}${hasDecimal ? `${decimal}${fracDigits}` : ""}`

  return { text, value: toNumber(negative, intDigits, fracDigits) }
}

// Decide which of `.` / `,` is the decimal separator in pasted text, which may
// come from another locale than the input's (a spreadsheet, a bank statement).
function detectDecimalSeparator(
  text: string,
  localeDecimal: string
): string | null {
  const lastDot = text.lastIndexOf(".")
  const lastComma = text.lastIndexOf(",")
  if (lastDot !== -1 && lastComma !== -1) {
    // Both present: whichever comes last is the decimal separator.
    return lastDot > lastComma ? "." : ","
  }
  let candidate: string | null = null
  if (lastDot !== -1) {
    candidate = "."
  } else if (lastComma !== -1) {
    candidate = ","
  }
  if (candidate === null) {
    return null
  }
  const occurrences = text.split(candidate).length - 1
  if (occurrences > 1) {
    return null // repeated → a group separator
  }
  if (candidate === localeDecimal) {
    return candidate
  }
  // A lone foreign separator followed by exactly three digits reads as a
  // thousands group (`1,234` in a `de-CH` input); otherwise it's a decimal.
  const after = text.slice(text.lastIndexOf(candidate) + 1)
  const digitsAfter = after.match(DIGITS)?.length ?? 0
  return digitsAfter === 3 ? null : candidate
}

/**
 * Parse free-form text (pasted, or a value from another system) into a
 * number. Tolerates currency codes and symbols, any whitespace or apostrophe
 * as grouping, `.` or `,` as the decimal separator, and `−`/`-` for negatives.
 * Returns `null` when no digits are found.
 */
function parseLocaleNumber(text: string, locale?: string): number | null {
  if (!DIGIT.test(text)) {
    return null
  }
  const { decimal } = getNumberSeparators(locale)
  const negative = LEADING_MINUS.test(text) || PARENTHESIZED.test(text)
  const kept = text.replace(NOT_NUMERIC, "")
  const decimalSeparator = detectDecimalSeparator(kept, decimal)
  let intPart = kept
  let fracPart = ""
  if (decimalSeparator) {
    const index = kept.lastIndexOf(decimalSeparator)
    intPart = kept.slice(0, index)
    fracPart = kept.slice(index + 1)
  }
  return toNumber(
    negative,
    intPart.replace(NON_DIGIT, ""),
    fracPart.replace(NON_DIGIT, "")
  )
}

// Characters that survive re-formatting: digits, the decimal separator and a
// leading minus. Counting them before the caret lets us put the caret back in
// the same logical place after separators were inserted or removed.
function countSignificant(text: string, end: number, decimal: string): number {
  let count = 0
  for (let i = 0; i < end && i < text.length; i += 1) {
    const char = text[i] as string
    if (DIGIT.test(char) || char === decimal || MINUS_SIGNS.test(char)) {
      count += 1
    }
  }
  return count
}

function caretForSignificant(
  text: string,
  significant: number,
  decimal: string
): number {
  if (significant <= 0) {
    return 0
  }
  let count = 0
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i] as string
    if (DIGIT.test(char) || char === decimal || char === "-") {
      count += 1
      if (count === significant) {
        return i + 1
      }
    }
  }
  return text.length
}

/**
 * Where the caret should land in `next` after the user edited `raw` with the
 * caret at `caret`.
 */
function mapCaret(
  raw: string,
  caret: number,
  next: string,
  locale?: string
): number {
  const { decimal } = getNumberSeparators(locale)
  return caretForSignificant(
    next,
    countSignificant(raw, caret, decimal),
    decimal
  )
}

/** Round to `digits` decimals without the `1.005 → 1.00` float surprise. */
function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  const rounded = Math.round((Math.abs(value) + Number.EPSILON) * factor)
  return (Math.sign(value) * rounded) / factor
}

export type {
  FormatNumberOptions,
  NumberSeparators,
  ParseTypedOptions,
  TypedNumber,
}
export {
  formatNumber,
  getNumberSeparators,
  mapCaret,
  parseLocaleNumber,
  parseTypedNumber,
  roundTo,
}
