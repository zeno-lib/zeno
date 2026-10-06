import { ChangeEvent, ClipboardEvent } from "react";
//#region src/lib/use-formatted-number.d.ts
type UseFormattedNumberOptions = {
  /** The stored value. `null`/`undefined` renders an empty input. */
  value: number | null | undefined;
  /** Called with the parsed value when the user types, pastes, or blurs. */
  onValueChange: (value: number | null) => void;
  /** Called after the blur re-format (wire the field's `handleBlur` here). */
  onBlur?: () => void;
  /** BCP 47 locale for separators. Defaults to the runtime locale. */
  locale?: string;
  /** Digits allowed after the decimal separator. Defaults to `2`. */
  maximumFractionDigits?: number;
  /**
   * Pad a non-integer value to `maximumFractionDigits` on blur (`12.5` →
   * `12.50`). Integers stay bare (`12`). Defaults to `false`.
   */
  padFraction?: boolean;
  /** Insert thousands separators. Defaults to `true`. */
  useGrouping?: boolean;
  /** Accept a leading minus. Defaults to `true`. */
  allowNegative?: boolean;
  /** Drop integer digits beyond this count while typing. */
  maxIntegerDigits?: number;
  /** Clamp the stored value on blur. */
  min?: number;
  /** Clamp the stored value on blur. */
  max?: number;
  /**
   * Map the stored value to the number shown in the input, e.g.
   * `(v) => v * 100` to edit a `0–1` fraction as a percentage. Pair with
   * `fromDisplay`.
   */
  toDisplay?: (value: number) => number;
  /** Inverse of `toDisplay`. */
  fromDisplay?: (display: number) => number;
};
type FormattedNumberInputProps = {
  inputMode: "decimal" | "numeric";
  onBlur: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void;
  type: "text";
  value: string;
};
/**
 * Headless, locale-aware formatted number input.
 *
 * Keeps the input's text in local state so the user can type freely
 * (`"1’2"`, `"12."`), re-inserting group separators as they type while
 * holding the caret in place, and parses the text into a `number | null`
 * for the form. Pasted text is parsed leniently (`"CHF 1'234.50"`,
 * `"1.234,50"`). On blur the value is clamped to `min`/`max` and the text
 * re-formatted. External value changes (e.g. `form.reset`) re-sync the text.
 *
 * Returns props to spread on an `<input>`; UI-free, so any input component
 * can use it.
 */
declare function useFormattedNumber({ value, onValueChange, onBlur, locale, maximumFractionDigits, padFraction, useGrouping, allowNegative, maxIntegerDigits, min, max, toDisplay, fromDisplay }: UseFormattedNumberOptions): FormattedNumberInputProps;
//#endregion
export { type FormattedNumberInputProps, type UseFormattedNumberOptions, useFormattedNumber };