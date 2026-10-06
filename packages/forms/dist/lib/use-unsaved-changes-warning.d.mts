import { AnyFormApi } from "@tanstack/react-form";
//#region src/lib/use-unsaved-changes-warning.d.ts
type UnsavedChangesMode = "if-changed" | "if-touched";
declare function useUnsavedChangesWarning(form: AnyFormApi, enabled: boolean | UnsavedChangesMode): void;
//#endregion
export { type UnsavedChangesMode, useUnsavedChangesWarning };