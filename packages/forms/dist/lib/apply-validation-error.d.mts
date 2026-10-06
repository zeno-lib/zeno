import { ValidationError } from "./validation-error.mjs";
import { AnyFormApi } from "@tanstack/react-form";
//#region src/lib/apply-validation-error.d.ts
declare function applyValidationError(formApi: AnyFormApi, error: ValidationError): void;
//#endregion
export { applyValidationError };