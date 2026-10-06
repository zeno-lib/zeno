//#region src/lib/action-result.ts
function toFieldName(path) {
	let name = "";
	for (const segment of path ?? []) {
		const key = typeof segment === "object" ? segment.key : segment;
		if (typeof key === "number") name += `[${key}]`;
		else {
			const part = typeof key === "symbol" ? key.description ?? "" : key;
			name += name === "" ? part : `.${part}`;
		}
	}
	return name;
}
function toActionError(issues) {
	const fieldErrors = {};
	const formErrors = [];
	for (const issue of issues) {
		const name = toFieldName(issue.path);
		if (name === "") formErrors.push(issue.message);
		else {
			const messages = fieldErrors[name] ?? [];
			messages.push(issue.message);
			fieldErrors[name] = messages;
		}
	}
	return {
		fieldErrors,
		formErrors
	};
}
//#endregion
export { toActionError, toFieldName };
