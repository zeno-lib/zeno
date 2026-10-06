"use client";
import { applyValidationError } from "./lib/apply-validation-error.mjs";
import { fieldContext, formContext } from "./lib/contexts.mjs";
import { deepMergeDefaults, extractZodDefaults } from "./lib/schema-defaults.mjs";
import { getRequiredPaths } from "./lib/schema-required.mjs";
import { useRebasedDefaultValues } from "./lib/use-rebased-default-values.mjs";
import { useUnsavedChangesWarning } from "./lib/use-unsaved-changes-warning.mjs";
import { ValidationError } from "./lib/validation-error.mjs";
import { blurThenChangeLogic } from "./lib/validation-logic.mjs";
import { DEFAULT_VALIDATION_MODE, setFormZenoState } from "./lib/validation-modes.mjs";
import { createFormHook } from "@tanstack/react-form";
import { useMemo } from "react";
import { jsx } from "react/jsx-runtime";
//#region src/create-zeno-form.tsx
function buildValidatorsFromSchema(schema, mode) {
	switch (mode) {
		case "blur": return { onBlur: schema };
		case "submit": return { onSubmit: schema };
		default: return { onChange: schema };
	}
}
function withMountListener(listeners, onMount) {
	const user = listeners?.onMount;
	return {
		...listeners,
		onMount: (props) => {
			onMount(props);
			user?.(props);
		}
	};
}
/**
* Build the wired Zeno form API from the caller's field + form components.
*
* The shadcn-style field components are dropped into the consumer's repo via the
* registry and injected here, so `@zeno-lib/forms` (npm) stays UI-free. Returns
* the `createFormHook` primitives plus the schema-aware `useForm` and the typed
* `useAppFields` wrappers (prop types are inferred from the injected components).
*/
function createZenoForm(config) {
	const { useAppForm, withFieldGroup, withForm } = createFormHook({
		fieldComponents: config.fieldComponents,
		fieldContext,
		formComponents: config.formComponents,
		formContext
	});
	function useAppFields(form) {
		return useMemo(() => {
			const Field = form.AppField;
			const wrappers = {};
			for (const key of Object.keys(config.fieldComponents)) {
				const Impl = config.fieldComponents[key];
				wrappers[key] = ({ name, validators, listeners, ...props }) => /* @__PURE__ */ jsx(Field, {
					listeners,
					name,
					validators,
					children: () => /* @__PURE__ */ jsx(Impl, { ...props })
				});
			}
			return wrappers;
		}, [form]);
	}
	function useForm(options) {
		const { schema, validators: validatorsInput, validationLogic: userValidationLogic, hideFieldErrors = false, requiredIndicator = true, unsavedChangesWarning = false, defaultValues: userDefaultValues, onSubmit: userOnSubmit, ...rest } = options;
		let schemaMode;
		let resolvedValidators;
		let resolvedValidationLogic;
		if (schema === void 0) {
			schemaMode = void 0;
			resolvedValidators = typeof validatorsInput === "object" && validatorsInput !== null ? validatorsInput : void 0;
			resolvedValidationLogic = userValidationLogic;
		} else {
			const mode = typeof validatorsInput === "string" ? validatorsInput : DEFAULT_VALIDATION_MODE;
			schemaMode = mode;
			resolvedValidators = buildValidatorsFromSchema(schema, mode);
			resolvedValidationLogic = mode === "blur-then-change" ? blurThenChangeLogic : void 0;
		}
		const wrappedOnSubmit = userOnSubmit ? (async (props) => {
			try {
				await userOnSubmit(props);
			} catch (error) {
				if (error instanceof ValidationError) {
					applyValidationError(props.formApi, error);
					return;
				}
				throw error;
			}
		}) : void 0;
		const requiredFields = useMemo(() => schema && requiredIndicator ? getRequiredPaths(schema) : /* @__PURE__ */ new Set(), [schema, requiredIndicator]);
		const schemaDefaults = useMemo(() => schema ? extractZodDefaults(schema) : void 0, [schema]);
		const mergedDefaultValues = useMemo(() => schemaDefaults ? deepMergeDefaults(schemaDefaults, userDefaultValues) : userDefaultValues, [schemaDefaults, userDefaultValues]);
		const rebased = useRebasedDefaultValues(mergedDefaultValues);
		const listeners = withMountListener(rest.listeners, rebased.onMount);
		const form = useAppForm({
			...rest,
			listeners,
			...rebased.defaultValues === void 0 ? {} : { defaultValues: rebased.defaultValues },
			...wrappedOnSubmit ? { onSubmit: wrappedOnSubmit } : {},
			...resolvedValidators ? { validators: resolvedValidators } : {},
			...resolvedValidationLogic ? { validationLogic: resolvedValidationLogic } : {}
		});
		setFormZenoState(form, {
			hideFieldErrors,
			requiredFields,
			requiredIndicator,
			...schemaMode === void 0 ? {} : { validation: schemaMode }
		});
		useUnsavedChangesWarning(form, unsavedChangesWarning);
		const fields = useAppFields(form);
		return useMemo(() => Object.assign(form, fields, config.formComponents), [form, fields]);
	}
	return {
		useAppFields,
		useAppForm,
		useForm,
		withFieldGroup,
		withForm
	};
}
//#endregion
export { createZenoForm };
