"use client";
import { getFormHideFieldErrors, getFormValidationMode, isFieldRequired } from "./validation-modes.mjs";
import { useSelector } from "@tanstack/react-form";
//#region src/lib/use-is-invalid.ts
function hasFieldLevelError(errorMap, errorSourceMap, cause) {
	if (!(errorMap && errorSourceMap)) return false;
	return errorSourceMap[cause] === "field" && errorMap[cause] !== void 0;
}
function modeAllowsDisplay(mode, isDirty, isBlurred, wasSubmitted) {
	if (mode === "change") return isDirty || wasSubmitted;
	if (mode === "submit") return wasSubmitted;
	return isBlurred || wasSubmitted;
}
function useIsInvalid(field) {
	const wasSubmitted = useSelector(field.form.store, (state) => state.submissionAttempts > 0);
	if (field.state.meta.isValid) return false;
	const { isDirty, isBlurred, errorMap, errorSourceMap } = field.state.meta;
	const sourceMap = errorSourceMap;
	if (hasFieldLevelError(errorMap, sourceMap, "onChange")) return isDirty || wasSubmitted;
	if (hasFieldLevelError(errorMap, sourceMap, "onBlur")) return isBlurred || wasSubmitted;
	if (hasFieldLevelError(errorMap, sourceMap, "onSubmit")) return wasSubmitted;
	return modeAllowsDisplay(getFormValidationMode(field.form), isDirty, isBlurred, wasSubmitted);
}
function useHideFieldErrors(field) {
	return getFormHideFieldErrors(field.form);
}
function useIsFieldRequired(field) {
	return isFieldRequired(field.form, field.name);
}
//#endregion
export { useHideFieldErrors, useIsFieldRequired, useIsInvalid };
