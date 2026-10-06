//#region src/lib/formatted-number.d.ts
type NumberSeparators = {
  /** Thousands separator, e.g. `’` for `de-CH`, `,` for `en-US`. */
  group: string;
  /** Decimal separator, e.g. `.` for `de-CH`, `,` for `de-DE`. */
  decimal: string;
};
type FormatNumberOptions = {
  locale?: string;
  /** Maximum digits after the decimal separator. `0` means integers only. */
  maximumFractionDigits: number;
  /** Minimum digits after the decimal separator (pads with zeros). */
  minimumFractionDigits?: number;
  /** Insert group (thousands) separators. Defaults to `true`. */
  useGrouping?: boolean;
};
type TypedNumber = {
  /** The re-formatted text to show in the input. */
  text: string;
  /** The parsed number, or `null` when the text holds no digits. */
  value: number | null;
};
type ParseTypedOptions = {
  locale?: string;
  maximumFractionDigits: number;
  useGrouping?: boolean;
  allowNegative?: boolean;
  /** Drop integer digits beyond this count (e.g. `4` for a year). */
  maxIntegerDigits?: number;
};
declare function getNumberSeparators(locale?: string): NumberSeparators;
/** Format a number for display (on blur, on reset, on first render). */
declare function formatNumber(value: number | null | undefined, { locale, maximumFractionDigits, minimumFractionDigits, useGrouping }: FormatNumberOptions): string;
/**
 * Re-format what the user is typing. Only the locale's decimal separator
 * starts the fraction; every other non-digit is dropped and group separators
 * are re-inserted. Keeps a trailing decimal separator (`"12."`) so typing
 * isn't fought, and truncates fraction digits beyond `maximumFractionDigits`.
 */
declare function parseTypedNumber(raw: string, { locale, maximumFractionDigits, useGrouping, allowNegative, maxIntegerDigits }: ParseTypedOptions): TypedNumber;
/**
 * Parse free-form text (pasted, or a value from another system) into a
 * number. Tolerates currency codes and symbols, any whitespace or apostrophe
 * as grouping, `.` or `,` as the decimal separator, and `−`/`-` for negatives.
 * Returns `null` when no digits are found.
 */
declare function parseLocaleNumber(text: string, locale?: string): number | null;
/**
 * Where the caret should land in `next` after the user edited `raw` with the
 * caret at `caret`.
 */
declare function mapCaret(raw: string, caret: number, next: string, locale?: string): number;
/** Round to `digits` decimals without the `1.005 → 1.00` float surprise. */
declare function roundTo(value: number, digits: number): number;
//#endregion
export { type FormatNumberOptions, type NumberSeparators, type ParseTypedOptions, type TypedNumber, formatNumber, getNumberSeparators, mapCaret, parseLocaleNumber, parseTypedNumber, roundTo };