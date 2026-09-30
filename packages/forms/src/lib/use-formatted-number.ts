"use client"

import {
  type ChangeEvent,
  type ClipboardEvent,
  useLayoutEffect,
  useReducer,
  useRef,
  useState,
} from "react"

import {
  formatNumber,
  mapCaret,
  parseLocaleNumber,
  parseTypedNumber,
  roundTo,
} from "./formatted-number"

type UseFormattedNumberOptions = {
  /** The stored value. `null`/`undefined` renders an empty input. */
  value: number | null | undefined
  /** Called with the parsed value when the user types, pastes, or blurs. */
  onValueChange: (value: number | null) => void
  /** Called after the blur re-format (wire the field's `handleBlur` here). */
  onBlur?: () => void
  /** BCP 47 locale for separators. Defaults to the runtime locale. */
  locale?: string
  /** Digits allowed after the decimal separator. Defaults to `2`. */
  maximumFractionDigits?: number
  /**
   * Pad a non-integer value to `maximumFractionDigits` on blur (`12.5` →
   * `12.50`). Integers stay bare (`12`). Defaults to `false`.
   */
  padFraction?: boolean
  /** Insert thousands separators. Defaults to `true`. */
  useGrouping?: boolean
  /** Accept a leading minus. Defaults to `true`. */
  allowNegative?: boolean
  /** Drop integer digits beyond this count while typing. */
  maxIntegerDigits?: number
  /** Clamp the stored value on blur. */
  min?: number
  /** Clamp the stored value on blur. */
  max?: number
  /**
   * Map the stored value to the number shown in the input, e.g.
   * `(v) => v * 100` to edit a `0–1` fraction as a percentage. Pair with
   * `fromDisplay`.
   */
  toDisplay?: (value: number) => number
  /** Inverse of `toDisplay`. */
  fromDisplay?: (display: number) => number
}

type FormattedNumberInputProps = {
  inputMode: "decimal" | "numeric"
  onBlur: () => void
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
  onPaste: (event: ClipboardEvent<HTMLInputElement>) => void
  type: "text"
  value: string
}

const identity = (value: number) => value

function clamp(value: number, min?: number, max?: number): number {
  let next = value
  if (min !== undefined && next < min) {
    next = min
  }
  if (max !== undefined && next > max) {
    next = max
  }
  return next
}

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
function useFormattedNumber({
  value,
  onValueChange,
  onBlur,
  locale,
  maximumFractionDigits = 2,
  padFraction = false,
  useGrouping = true,
  allowNegative = true,
  maxIntegerDigits,
  min,
  max,
  toDisplay = identity,
  fromDisplay = identity,
}: UseFormattedNumberOptions): FormattedNumberInputProps {
  const current = value ?? null

  const display = (stored: number | null): string => {
    if (stored === null) {
      return ""
    }
    const shown = roundTo(toDisplay(stored), maximumFractionDigits)
    return formatNumber(shown, {
      locale,
      maximumFractionDigits,
      minimumFractionDigits:
        padFraction && !Number.isInteger(shown) ? maximumFractionDigits : 0,
      useGrouping,
    })
  }

  const [text, setText] = useState(() => display(current))
  // The value the text was last derived from or parsed into. When the prop
  // drifts from it, something outside the input changed the value.
  const [synced, setSynced] = useState<number | null>(current)
  if (!Object.is(current, synced)) {
    setSynced(current)
    setText(display(current))
  }

  // Re-render even when the re-formatted text is unchanged (a rejected
  // keystroke), so the layout effect can put the caret back after React
  // restores the controlled value.
  const [, forceRender] = useReducer((n: number) => n + 1, 0)
  const pendingCaret = useRef<{ input: HTMLInputElement; at: number } | null>(
    null
  )
  useLayoutEffect(() => {
    const pending = pendingCaret.current
    if (!pending) {
      return
    }
    pendingCaret.current = null
    if (pending.input.ownerDocument.activeElement === pending.input) {
      pending.input.setSelectionRange(pending.at, pending.at)
    }
  })

  const fromDisplayRounded = (shown: number) =>
    fromDisplay === identity
      ? shown
      : roundTo(fromDisplay(shown), maximumFractionDigits + 4)

  const commit = (nextText: string, nextValue: number | null) => {
    setText(nextText)
    setSynced(nextValue)
    if (!Object.is(nextValue, current)) {
      onValueChange(nextValue)
    }
  }

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const raw = input.value
    const typed = parseTypedNumber(raw, {
      allowNegative,
      locale,
      maxIntegerDigits,
      maximumFractionDigits,
      useGrouping,
    })
    const caret = input.selectionStart ?? raw.length
    pendingCaret.current = {
      at: mapCaret(raw, caret, typed.text, locale),
      input,
    }
    commit(
      typed.text,
      typed.value === null ? null : fromDisplayRounded(typed.value)
    )
    forceRender()
  }

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const replacesAll =
      input.value === "" ||
      (input.selectionStart === 0 && input.selectionEnd === input.value.length)
    if (!replacesAll) {
      return // partial paste: let the change handler re-format the result
    }
    const parsed = parseLocaleNumber(
      event.clipboardData.getData("text"),
      locale
    )
    if (parsed === null) {
      return
    }
    const shown = roundTo(
      allowNegative ? parsed : Math.abs(parsed),
      maximumFractionDigits
    )
    if (
      maxIntegerDigits !== undefined &&
      Math.abs(Math.trunc(shown)) >= 10 ** maxIntegerDigits
    ) {
      return // too long: the change handler truncates the pasted digits
    }
    event.preventDefault()
    const stored = fromDisplayRounded(shown)
    commit(display(stored), stored)
  }

  const handleBlur = () => {
    if (current === null) {
      setText("")
    } else {
      const clamped = clamp(current, min, max)
      commit(display(clamped), clamped)
    }
    onBlur?.()
  }

  return {
    inputMode: maximumFractionDigits > 0 ? "decimal" : "numeric",
    onBlur: handleBlur,
    onChange,
    onPaste,
    type: "text",
    value: text,
  }
}

export type { FormattedNumberInputProps, UseFormattedNumberOptions }
export { useFormattedNumber }
