//#region src/lib/validation-error.ts
var ValidationError = class extends Error {
	constructor(fields, options = {}) {
		super(options.message ?? "Validation failed");
		this.name = "ValidationError";
		this.fields = fields;
		this.formError = options.formError;
	}
};
//#endregion
export { ValidationError };
