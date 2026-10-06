"use client";
import { useCallback, useRef, useState } from "react";
//#region src/lib/use-form-dialog.ts
/**
* Open/close state for a dialog-hosted form, one "session" per `open()`.
*
* Why the hook owns the defaults: TanStack Form ignores new `defaultValues`
* once the form is touched, and a `form.reset(values)` is undone on the next
* render when `useForm` still receives the old `defaultValues` (the form is
* untouched again after the reset, so TanStack re-applies its options).
* Passing `dialog.defaultValues` to `useForm` keeps the two in agreement;
* the `FormDialog` component then calls `form.reset(defaults)` at the start
* of every session.
*/
function useFormDialog(options = {}) {
	const latestDefaults = useRef(options.defaultValues);
	latestDefaults.current = options.defaultValues;
	const [state, setState] = useState(() => ({
		defaultValues: options.defaultValues,
		focus: void 0,
		isOpen: false,
		session: 0
	}));
	const open = useCallback((openOptions) => {
		setState((previous) => ({
			defaultValues: openOptions?.defaultValues ?? latestDefaults.current,
			focus: openOptions?.focus,
			isOpen: true,
			session: previous.session + 1
		}));
	}, []);
	return {
		close: useCallback(() => {
			setState((previous) => previous.isOpen ? {
				...previous,
				isOpen: false
			} : previous);
		}, []),
		defaultValues: state.defaultValues,
		focus: state.focus,
		isOpen: state.isOpen,
		open,
		session: state.session
	};
}
/** Ask before a leave (close, navigate, switch record) drops unsaved changes. */
function useLeaveGuard({ hasUnsavedChanges }) {
	const pending = useRef(null);
	const [isConfirming, setIsConfirming] = useState(false);
	const requestLeave = useCallback((proceed) => {
		if (!hasUnsavedChanges) {
			proceed();
			return;
		}
		pending.current = proceed;
		setIsConfirming(true);
	}, [hasUnsavedChanges]);
	const confirmLeave = useCallback(() => {
		const proceed = pending.current;
		pending.current = null;
		setIsConfirming(false);
		proceed?.();
	}, []);
	return {
		cancelLeave: useCallback(() => {
			pending.current = null;
			setIsConfirming(false);
		}, []),
		confirmLeave,
		isConfirming,
		requestLeave
	};
}
const FOCUSABLE = "input:not([type=\"hidden\"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex=\"-1\"])";
function attributeSelector(attribute, value) {
	return `[${attribute}="${value.replace(/["\\]/g, "\\$&")}"]`;
}
/**
* Find the element to focus for field `name` inside `root`: the control with
* `id={name}` (what the shipped fields render), else the first focusable
* element inside the field root marked `data-field={name}`.
*/
function findFieldElement(root, name) {
	if (!root) return null;
	const byId = root.querySelector(attributeSelector("id", name));
	if (byId) return byId;
	return root.querySelector(attributeSelector("data-field", name))?.querySelector(FOCUSABLE) ?? null;
}
//#endregion
export { findFieldElement, useFormDialog, useLeaveGuard };
