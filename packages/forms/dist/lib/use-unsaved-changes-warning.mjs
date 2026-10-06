"use client";
import { useSelector } from "@tanstack/react-form";
import { useEffect } from "react";
//#region src/lib/use-unsaved-changes-warning.ts
function useUnsavedChangesWarning(form, enabled) {
	let mode;
	if (enabled === false) mode = null;
	else if (enabled === true) mode = "if-changed";
	else mode = enabled;
	const dirty = useSelector(form.store, (state) => mode === "if-touched" ? state.isDirty : !state.isDefaultValue);
	const isSubmitting = useSelector(form.store, (state) => state.isSubmitting);
	const active = mode !== null && dirty && !isSubmitting;
	useEffect(() => {
		if (!active) return;
		const handler = (event) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", handler);
		return () => window.removeEventListener("beforeunload", handler);
	}, [active]);
}
//#endregion
export { useUnsavedChangesWarning };
