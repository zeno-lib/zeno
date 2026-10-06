"use client";
import { createFormHookContexts } from "@tanstack/react-form";
//#region src/lib/contexts.ts
const { fieldContext, formContext, useFieldContext, useFormContext } = createFormHookContexts();
const FormProvider = formContext.Provider;
//#endregion
export { FormProvider, fieldContext, formContext, useFieldContext, useFormContext };
