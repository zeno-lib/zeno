"use client";
import { toRequiredPathKey } from "./schema-required.mjs";
//#region src/lib/validation-modes.ts
const DEFAULT_VALIDATION_MODE = "blur-then-change";
const DEFAULT_FORM_STATE = {
	hideFieldErrors: false,
	requiredFields: /* @__PURE__ */ new Set(),
	requiredIndicator: true,
	validation: DEFAULT_VALIDATION_MODE
};
const formZenoState = /* @__PURE__ */ new WeakMap();
function stateKey(form) {
	return form.store;
}
function setFormZenoState(form, state) {
	const key = stateKey(form);
	const current = formZenoState.get(key) ?? DEFAULT_FORM_STATE;
	formZenoState.set(key, {
		...current,
		...state
	});
}
function getFormZenoState(form) {
	return formZenoState.get(stateKey(form)) ?? DEFAULT_FORM_STATE;
}
function getFormValidationMode(form) {
	return getFormZenoState(form).validation;
}
function getFormHideFieldErrors(form) {
	return getFormZenoState(form).hideFieldErrors;
}
function isFieldRequired(form, name) {
	const state = getFormZenoState(form);
	if (!state.requiredIndicator) return false;
	return state.requiredFields.has(toRequiredPathKey(name));
}
//#endregion
export { DEFAULT_VALIDATION_MODE, getFormHideFieldErrors, getFormValidationMode, isFieldRequired, setFormZenoState };
