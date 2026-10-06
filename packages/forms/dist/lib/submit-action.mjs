import { applyValidationError } from "./apply-validation-error.mjs";
import { ValidationError } from "./validation-error.mjs";
import { toActionError } from "./action-result.mjs";
//#region src/lib/submit-action.ts
function applyActionError(formApi, error) {
	const fields = {};
	const formErrors = [...error.formErrors];
	const fieldInfo = formApi.fieldInfo;
	for (const [name, messages] of Object.entries(error.fieldErrors)) {
		if (messages.length === 0) continue;
		if (fieldInfo[name]?.instance) fields[name] = messages;
		else formErrors.push(...messages);
	}
	applyValidationError(formApi, new ValidationError(fields, formErrors.length > 0 ? { formError: formErrors.join("\n") } : {}));
}
async function submitAction(props, action, options = {}) {
	const { formApi, value } = props;
	let input = value;
	if (options.schema) {
		const parsed = await options.schema["~standard"].validate(value);
		if (parsed.issues) {
			const error = toActionError(parsed.issues);
			applyActionError(formApi, error);
			return {
				error,
				ok: false
			};
		}
		input = parsed.value;
	}
	const result = await action(input);
	if (!result.ok) {
		applyActionError(formApi, result.error);
		return result;
	}
	const { reset } = options;
	if (reset === true) formApi.reset(result.data);
	else if (reset === "values") formApi.reset(value);
	else if (typeof reset === "function") formApi.reset(reset(result.data));
	return result;
}
//#endregion
export { applyActionError, submitAction };
