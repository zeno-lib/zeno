"use client";
import { FormProvider as FormProvider$1, useFormContext } from "./lib/contexts.mjs";
import { jsx } from "react/jsx-runtime";
//#region src/form-element.tsx
function FormProvider({ children, form }) {
	return /* @__PURE__ */ jsx(FormProvider$1, {
		value: form,
		children
	});
}
function Form({ children, className, ...props }) {
	const form = useFormContext();
	return /* @__PURE__ */ jsx("form", {
		className,
		noValidate: true,
		onSubmit: async (event) => {
			event.preventDefault();
			event.stopPropagation();
			const node = event.currentTarget;
			await Promise.resolve(form.handleSubmit()).catch(() => void 0);
			if (!form.state.isValid) {
				const invalid = node.querySelector("[aria-invalid=\"true\"]");
				(invalid ? [invalid, ...invalid.querySelectorAll("*")] : []).find((el) => el.tabIndex >= 0)?.focus();
			}
		},
		...props,
		children
	});
}
//#endregion
export { Form, FormProvider };
