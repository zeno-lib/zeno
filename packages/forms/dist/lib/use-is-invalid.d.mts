import { AnyFieldApi } from "@tanstack/react-form";
//#region src/lib/use-is-invalid.d.ts
declare function useIsInvalid(field: AnyFieldApi): boolean;
declare function useHideFieldErrors(field: AnyFieldApi): boolean;
declare function useIsFieldRequired(field: AnyFieldApi): boolean;
//#endregion
export { useHideFieldErrors, useIsFieldRequired, useIsInvalid };