//#region src/lib/contexts.d.ts
declare const fieldContext: import("react").Context<import("@tanstack/react-form").AnyFieldApi>, formContext: import("react").Context<import("@tanstack/react-form").AnyFormApi>, useFieldContext: <TData>() => import("@tanstack/react-form").FieldApi<any, string, TData, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any, any>, useFormContext: () => import("@tanstack/react-form").ReactFormExtendedApi<Record<string, never>, any, any, any, any, any, any, any, any, any, any, any>;
declare const FormProvider: import("react").Provider<import("@tanstack/react-form").AnyFormApi>;
//#endregion
export { FormProvider, fieldContext, formContext, useFieldContext, useFormContext };