//#region src/lib/formatted-number.ts
const separatorCache = /* @__PURE__ */ new Map();
const MINUS_SIGNS = /[-−–]/;
const LEADING_MINUS = /^[^\d]*[-−–]/;
const NON_DIGIT = /\D/g;
const LEADING_ZEROS = /^0+(?=\d)/;
const DIGIT = /\d/;
const DIGITS = /\d/g;
const PARENTHESIZED = /^\s*\(.*\)\s*$/;
const NOT_NUMERIC = /[^\d.,]/g;
const UNICODE_MINUS = /\u2212/g;
function getNumberSeparators(locale) {
	const key = locale ?? "";
	const cached = separatorCache.get(key);
	if (cached) return cached;
	const parts = new Intl.NumberFormat(locale, { numberingSystem: "latn" }).formatToParts(1234567.5);
	const separators = {
		decimal: parts.find((p) => p.type === "decimal")?.value ?? ".",
		group: parts.find((p) => p.type === "group")?.value ?? ","
	};
	separatorCache.set(key, separators);
	return separators;
}
function normalizeMinus(text) {
	return text.replace(UNICODE_MINUS, "-");
}
/** Format a number for display (on blur, on reset, on first render). */
function formatNumber(value, { locale, maximumFractionDigits, minimumFractionDigits = 0, useGrouping = true }) {
	if (value == null || !Number.isFinite(value)) return "";
	return normalizeMinus(new Intl.NumberFormat(locale, {
		maximumFractionDigits,
		minimumFractionDigits: Math.min(minimumFractionDigits, maximumFractionDigits),
		numberingSystem: "latn",
		useGrouping
	}).format(value));
}
function groupIntegerDigits(digits, locale, useGrouping) {
	if (!useGrouping || digits.length <= 3) return digits;
	return new Intl.NumberFormat(locale, {
		numberingSystem: "latn",
		useGrouping: true
	}).format(BigInt(digits));
}
function toNumber(negative, intDigits, fracDigits) {
	if (intDigits === "" && fracDigits === "") return null;
	const value = Number(`${intDigits || "0"}.${fracDigits || "0"}`);
	return negative && value !== 0 ? -value : value;
}
/**
* Re-format what the user is typing. Only the locale's decimal separator
* starts the fraction; every other non-digit is dropped and group separators
* are re-inserted. Keeps a trailing decimal separator (`"12."`) so typing
* isn't fought, and truncates fraction digits beyond `maximumFractionDigits`.
*/
function parseTypedNumber(raw, { locale, maximumFractionDigits, useGrouping = true, allowNegative = true, maxIntegerDigits }) {
	const { decimal } = getNumberSeparators(locale);
	const negative = allowNegative && LEADING_MINUS.test(raw);
	const decimalIndex = maximumFractionDigits > 0 ? raw.indexOf(decimal) : -1;
	const intRaw = decimalIndex === -1 ? raw : raw.slice(0, decimalIndex);
	const fracRaw = decimalIndex === -1 ? "" : raw.slice(decimalIndex + 1);
	let intDigits = intRaw.replace(NON_DIGIT, "").replace(LEADING_ZEROS, "");
	if (maxIntegerDigits !== void 0) intDigits = intDigits.slice(0, maxIntegerDigits);
	const fracDigits = fracRaw.replace(NON_DIGIT, "").slice(0, maximumFractionDigits);
	const hasDecimal = decimalIndex !== -1;
	return {
		text: `${negative ? "-" : ""}${intDigits === "" && hasDecimal ? "0" : groupIntegerDigits(intDigits, locale, useGrouping)}${hasDecimal ? `${decimal}${fracDigits}` : ""}`,
		value: toNumber(negative, intDigits, fracDigits)
	};
}
function detectDecimalSeparator(text, localeDecimal) {
	const lastDot = text.lastIndexOf(".");
	const lastComma = text.lastIndexOf(",");
	if (lastDot !== -1 && lastComma !== -1) return lastDot > lastComma ? "." : ",";
	let candidate = null;
	if (lastDot !== -1) candidate = ".";
	else if (lastComma !== -1) candidate = ",";
	if (candidate === null) return null;
	if (text.split(candidate).length - 1 > 1) return null;
	if (candidate === localeDecimal) return candidate;
	return (text.slice(text.lastIndexOf(candidate) + 1).match(DIGITS)?.length ?? 0) === 3 ? null : candidate;
}
/**
* Parse free-form text (pasted, or a value from another system) into a
* number. Tolerates currency codes and symbols, any whitespace or apostrophe
* as grouping, `.` or `,` as the decimal separator, and `−`/`-` for negatives.
* Returns `null` when no digits are found.
*/
function parseLocaleNumber(text, locale) {
	if (!DIGIT.test(text)) return null;
	const { decimal } = getNumberSeparators(locale);
	const negative = LEADING_MINUS.test(text) || PARENTHESIZED.test(text);
	const kept = text.replace(NOT_NUMERIC, "");
	const decimalSeparator = detectDecimalSeparator(kept, decimal);
	let intPart = kept;
	let fracPart = "";
	if (decimalSeparator) {
		const index = kept.lastIndexOf(decimalSeparator);
		intPart = kept.slice(0, index);
		fracPart = kept.slice(index + 1);
	}
	return toNumber(negative, intPart.replace(NON_DIGIT, ""), fracPart.replace(NON_DIGIT, ""));
}
function countSignificant(text, end, decimal) {
	let count = 0;
	for (let i = 0; i < end && i < text.length; i++) {
		const char = text[i];
		if (DIGIT.test(char) || char === decimal || MINUS_SIGNS.test(char)) count++;
	}
	return count;
}
function caretForSignificant(text, significant, decimal) {
	if (significant <= 0) return 0;
	let count = 0;
	for (let i = 0; i < text.length; i++) {
		const char = text[i];
		if (DIGIT.test(char) || char === decimal || char === "-") {
			count++;
			if (count === significant) return i + 1;
		}
	}
	return text.length;
}
/**
* Where the caret should land in `next` after the user edited `raw` with the
* caret at `caret`.
*/
function mapCaret(raw, caret, next, locale) {
	const { decimal } = getNumberSeparators(locale);
	return caretForSignificant(next, countSignificant(raw, caret, decimal), decimal);
}
/** Round to `digits` decimals without the `1.005 → 1.00` float surprise. */
function roundTo(value, digits) {
	const factor = 10 ** digits;
	const rounded = Math.round((Math.abs(value) + Number.EPSILON) * factor);
	return Math.sign(value) * rounded / factor;
}
//#endregion
export { formatNumber, getNumberSeparators, mapCaret, parseLocaleNumber, parseTypedNumber, roundTo };
