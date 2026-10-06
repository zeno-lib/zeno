import { AnyFormApi } from "@tanstack/react-form";
//#region src/lib/validation-modes.d.ts
type ValidationMode = "change" | "blur" | "submit" | "blur-then-change";
declare const DEFAULT_VALIDATION_MODE: ValidationMode;
type ZenoFormState = {
  validation: ValidationMode;
  hideFieldErrors: boolean;
  requiredIndicator: boolean;
  requiredFields: ReadonlySet<string>;
};
declare function setFormZenoState(form: AnyFormApi, state: Partial<ZenoFormState>): void;
declare function getFormValidationMode(form: AnyFormApi): ValidationMode;
declare function getFormHideFieldErrors(form: AnyFormApi): boolean;
declare function isFieldRequired(form: AnyFormApi, name: string): boolean;
//#endregion
export { DEFAULT_VALIDATION_MODE, type ValidationMode, getFormHideFieldErrors, getFormValidationMode, isFieldRequired, setFormZenoState };