//#region src/lib/apply-validation-error.ts
function clearWhenEdited(formApi, name, entry) {
	const rejected = formApi.getFieldValue(name);
	const subscription = formApi.store.subscribe(() => {
		if (formApi.getFieldMeta(name)?.errorMap?.onChange !== entry) {
			subscription.unsubscribe();
			return;
		}
		if (Object.is(formApi.getFieldValue(name), rejected)) return;
		subscription.unsubscribe();
		formApi.setFieldMeta(name, (prev) => ({
			...prev,
			errorMap: {
				...prev.errorMap,
				onChange: void 0
			}
		}));
	});
}
function applyValidationError(formApi, error) {
	for (const [name, message] of Object.entries(error.fields)) {
		const errors = (Array.isArray(message) ? message : [message]).map((m) => ({ message: m }));
		const entry = errors.length === 1 ? errors[0] : errors;
		formApi.setFieldMeta(name, (prev) => ({
			...prev,
			errorMap: {
				...prev.errorMap,
				onChange: entry
			},
			errors,
			isValid: false
		}));
		clearWhenEdited(formApi, name, entry);
	}
	if (error.formError) formApi.setErrorMap({ onSubmit: {
		fields: {},
		form: error.formError
	} });
}
//#endregion
export { applyValidationError };
