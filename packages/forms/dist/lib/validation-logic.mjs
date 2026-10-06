"use client";
//#region src/lib/validation-logic.ts
function pickLiveValidator(validators, isAsync) {
	const fn = isAsync ? validators?.onChangeAsync ?? validators?.onBlurAsync : validators?.onChange ?? validators?.onBlur;
	return fn ? {
		cause: "change",
		fn
	} : void 0;
}
function shouldRunFormChange(form) {
	if (form.state.submissionAttempts > 0) return true;
	return Object.values(form.state.fieldMeta).some((meta) => meta?.isBlurred === true);
}
function fieldLevelLogic(props) {
	const { event, validators, form } = props;
	const run = props.runValidation;
	if (!validators) return run({
		form,
		validators: []
	});
	const isAsync = event.async;
	if (event.type === "mount") return run({
		form,
		validators: isAsync ? [] : [{
			cause: "mount",
			fn: validators.onMount
		}]
	});
	if (event.type === "change") return run({
		form,
		validators: [{
			cause: "change",
			fn: isAsync ? validators.onChangeAsync : validators.onChange
		}]
	});
	if (event.type === "blur") return run({
		form,
		validators: [{
			cause: "blur",
			fn: isAsync ? validators.onBlurAsync : validators.onBlur
		}]
	});
	if (event.type === "submit") return run({
		form,
		validators: [
			{
				cause: "change",
				fn: isAsync ? validators.onChangeAsync : validators.onChange
			},
			{
				cause: "blur",
				fn: isAsync ? validators.onBlurAsync : validators.onBlur
			},
			{
				cause: "submit",
				fn: isAsync ? validators.onSubmitAsync : validators.onSubmit
			}
		]
	});
	return run({
		form,
		validators: []
	});
}
function buildSubmitValidators(validators, isAsync, liveValidator) {
	return [
		...liveValidator ? [liveValidator] : [],
		{
			cause: "submit",
			fn: isAsync ? validators.onSubmitAsync : validators.onSubmit
		},
		...isAsync ? [] : [{
			cause: "server",
			fn: () => void 0
		}]
	];
}
function blurThenChangeLogicImpl(props) {
	if (props.event.fieldName !== void 0) return fieldLevelLogic(props);
	const { event, validators, form } = props;
	const run = props.runValidation;
	if (!validators) return run({
		form,
		validators: []
	});
	const isAsync = event.async;
	const liveValidator = pickLiveValidator(validators, isAsync);
	if (event.type === "mount") return run({
		form,
		validators: isAsync ? [] : [{
			cause: "mount",
			fn: validators.onMount
		}]
	});
	if (event.type === "blur") return run({
		form,
		validators: liveValidator ? [liveValidator] : []
	});
	if (event.type === "change") return run({
		form,
		validators: liveValidator && shouldRunFormChange(form) ? [liveValidator] : []
	});
	if (event.type === "submit") return run({
		form,
		validators: buildSubmitValidators(validators, isAsync, liveValidator)
	});
	return run({
		form,
		validators: []
	});
}
const blurThenChangeLogic = blurThenChangeLogicImpl;
//#endregion
export { blurThenChangeLogic };
