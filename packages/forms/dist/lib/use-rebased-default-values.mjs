"use client";
import { evaluate } from "@tanstack/react-form";
import { useCallback, useRef } from "react";
//#region src/lib/use-rebased-default-values.ts
function useRebasedDefaultValues(callerDefaults) {
	const liveForm = useRef(null);
	const lastCallerDefaults = useRef(callerDefaults);
	let defaultValues = callerDefaults;
	if (evaluate(lastCallerDefaults.current, callerDefaults)) {
		if (liveForm.current) defaultValues = liveForm.current.options.defaultValues;
	} else lastCallerDefaults.current = callerDefaults;
	const onMount = useCallback((props) => {
		liveForm.current = props.formApi;
	}, []);
	return {
		defaultValues,
		onMount
	};
}
//#endregion
export { useRebasedDefaultValues };
