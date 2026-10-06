"use client";
import { formatNumber, mapCaret, parseLocaleNumber, parseTypedNumber, roundTo } from "./formatted-number.mjs";
import { useLayoutEffect, useReducer, useRef, useState } from "react";
//#region src/lib/use-formatted-number.ts
const identity = (value) => value;
function clamp(value, min, max) {
	let next = value;
	if (min !== void 0 && next < min) next = min;
	if (max !== void 0 && next > max) next = max;
	return next;
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
function useFormattedNumber({ value, onValueChange, onBlur, locale, maximumFractionDigits = 2, padFraction = false, useGrouping = true, allowNegative = true, maxIntegerDigits, min, max, toDisplay = identity, fromDisplay = identity }) {
	const current = value ?? null;
	const display = (stored) => {
		if (stored === null) return "";
		const shown = roundTo(toDisplay(stored), maximumFractionDigits);
		return formatNumber(shown, {
			locale,
			maximumFractionDigits,
			minimumFractionDigits: padFraction && !Number.isInteger(shown) ? maximumFractionDigits : 0,
			useGrouping
		});
	};
	const [text, setText] = useState(() => display(current));
	const [synced, setSynced] = useState(current);
	if (!Object.is(current, synced)) {
		setSynced(current);
		setText(display(current));
	}
	const [, forceRender] = useReducer((n) => n + 1, 0);
	const pendingCaret = useRef(null);
	useLayoutEffect(() => {
		const pending = pendingCaret.current;
		if (!pending) return;
		pendingCaret.current = null;
		if (pending.input.ownerDocument.activeElement === pending.input) pending.input.setSelectionRange(pending.at, pending.at);
	});
	const fromDisplayRounded = (shown) => fromDisplay === identity ? shown : roundTo(fromDisplay(shown), maximumFractionDigits + 4);
	const commit = (nextText, nextValue) => {
		setText(nextText);
		setSynced(nextValue);
		if (!Object.is(nextValue, current)) onValueChange(nextValue);
	};
	const onChange = (event) => {
		const input = event.target;
		const raw = input.value;
		const typed = parseTypedNumber(raw, {
			allowNegative,
			locale,
			maxIntegerDigits,
			maximumFractionDigits,
			useGrouping
		});
		const caret = input.selectionStart ?? raw.length;
		pendingCaret.current = {
			at: mapCaret(raw, caret, typed.text, locale),
			input
		};
		commit(typed.text, typed.value === null ? null : fromDisplayRounded(typed.value));
		forceRender();
	};
	const onPaste = (event) => {
		const input = event.currentTarget;
		if (!(input.value === "" || input.selectionStart === 0 && input.selectionEnd === input.value.length)) return;
		const parsed = parseLocaleNumber(event.clipboardData.getData("text"), locale);
		if (parsed === null) return;
		const shown = roundTo(allowNegative ? parsed : Math.abs(parsed), maximumFractionDigits);
		if (maxIntegerDigits !== void 0 && Math.abs(Math.trunc(shown)) >= 10 ** maxIntegerDigits) return;
		event.preventDefault();
		const stored = fromDisplayRounded(shown);
		commit(display(stored), stored);
	};
	const handleBlur = () => {
		if (current === null) setText("");
		else {
			const clamped = clamp(current, min, max);
			commit(display(clamped), clamped);
		}
		onBlur?.();
	};
	return {
		inputMode: maximumFractionDigits > 0 ? "decimal" : "numeric",
		onBlur: handleBlur,
		onChange,
		onPaste,
		type: "text",
		value: text
	};
}
//#endregion
export { useFormattedNumber };
