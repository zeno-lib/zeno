import { ValidationMode } from "./lib/validation-modes.mjs";
import { DeepKeys, FormAsyncValidateOrFn, FormOptions, FormValidateOrFn } from "@tanstack/react-form";
import { ComponentProps, ReactNode } from "react";
//#region src/create-zeno-form.d.ts
type StandardSchema<T> = {
  readonly "~standard": {
    readonly validate: (value: unknown) => unknown;
    readonly types?: {
      readonly input: T;
      readonly output: T;
    };
  };
};
type PartialFormData<T> = T extends readonly unknown[] ? T : T extends Date | RegExp | ((...args: never[]) => unknown) ? T : T extends object ? { [K in keyof T]?: PartialFormData<T[K]>; } : T;
type ZenoFormExtras<TFormData> = {
  /**
   * If `true`, shipped fields skip rendering their inline `<FieldError>`
   * message. Fields still flip `data-invalid` / `aria-invalid`.
   */
  hideFieldErrors?: boolean;
  /**
   * Show a `*` next to the label of every field the schema treats as required.
   * Defaults to `true`. Required-ness is detected by probing the schema.
   */
  requiredIndicator?: boolean;
  /**
   * Warn the user before they navigate away with unsaved changes.
   * `"if-changed"` (or `true`) warns while values differ from defaults;
   * `"if-touched"` warns after any edit.
   */
  unsavedChangesWarning?: boolean | "if-changed" | "if-touched";
  /**
   * Initial values, relaxed to a deep partial so schema-provided defaults can
   * be omitted. See `lib/schema-defaults.ts`.
   */
  defaultValues?: PartialFormData<TFormData>;
};
type SchemaPathExtras<TFormData> = {
  schema: StandardSchema<TFormData>;
  validators?: ValidationMode;
  validationLogic?: never;
};
type ManualPathExtras = {
  schema?: never;
};
type SchemaFormOptions<TFormData, TOnMount extends undefined | FormValidateOrFn<TFormData>, TOnChange extends undefined | FormValidateOrFn<TFormData>, TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnBlur extends undefined | FormValidateOrFn<TFormData>, TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnSubmit extends undefined | FormValidateOrFn<TFormData>, TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnDynamic extends undefined | FormValidateOrFn<TFormData>, TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>, TSubmitMeta> = Omit<FormOptions<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta>, "defaultValues" | "validators" | "validationLogic"> & SchemaPathExtras<TFormData> & ZenoFormExtras<TFormData>;
type ManualFormOptions<TFormData, TOnMount extends undefined | FormValidateOrFn<TFormData>, TOnChange extends undefined | FormValidateOrFn<TFormData>, TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnBlur extends undefined | FormValidateOrFn<TFormData>, TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnSubmit extends undefined | FormValidateOrFn<TFormData>, TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnDynamic extends undefined | FormValidateOrFn<TFormData>, TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>, TSubmitMeta> = Omit<FormOptions<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta>, "defaultValues"> & ManualPathExtras & ZenoFormExtras<TFormData>;
type UseFormOptions<TFormData, TOnMount extends undefined | FormValidateOrFn<TFormData>, TOnChange extends undefined | FormValidateOrFn<TFormData>, TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnBlur extends undefined | FormValidateOrFn<TFormData>, TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnSubmit extends undefined | FormValidateOrFn<TFormData>, TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnDynamic extends undefined | FormValidateOrFn<TFormData>, TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>, TSubmitMeta> = SchemaFormOptions<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta> | ManualFormOptions<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta>;
type FormDataOf<F> = F extends {
  state: {
    values: infer V;
  };
} ? V : never;
type AnyAppForm = {
  AppField: unknown;
  state: {
    values: unknown;
  };
};
type AnyFieldValidators = {
  onMount?: unknown;
  onChange?: unknown;
  onChangeAsync?: unknown;
  onChangeAsyncDebounceMs?: number;
  onBlur?: unknown;
  onBlurAsync?: unknown;
  onBlurAsyncDebounceMs?: number;
  onSubmit?: unknown;
  onSubmitAsync?: unknown;
  onSubmitAsyncDebounceMs?: number;
  onDynamic?: unknown;
  onDynamicAsync?: unknown;
};
type AnyFieldListeners = {
  onChange?: unknown;
  onChangeDebounceMs?: number;
  onBlur?: unknown;
  onBlurDebounceMs?: number;
  onMount?: unknown;
  onSubmit?: unknown;
};
type WithValidators = {
  validators?: AnyFieldValidators;
  listeners?: AnyFieldListeners;
};
type AnyComponent = React.ComponentType<any>;
type FieldWrappers<FC extends Record<string, AnyComponent>, T> = { [K in keyof FC]: <N extends DeepKeys<T>>(props: ComponentProps<FC[K]> & {
  name: N;
} & WithValidators) => ReactNode; };
type CreateZenoFormConfig<FC extends Record<string, AnyComponent>, FMC extends Record<string, AnyComponent>> = {
  fieldComponents: FC;
  formComponents: FMC;
};
/**
 * Build the wired Zeno form API from the caller's field + form components.
 *
 * The shadcn-style field components are dropped into the consumer's repo via the
 * registry and injected here, so `@zeno-lib/forms` (npm) stays UI-free. Returns
 * the `createFormHook` primitives plus the schema-aware `useForm` and the typed
 * `useAppFields` wrappers (prop types are inferred from the injected components).
 */
declare function createZenoForm<FC extends Record<string, AnyComponent>, FMC extends Record<string, AnyComponent>>(config: CreateZenoFormConfig<FC, FMC>): {
  useAppFields: <TForm extends AnyAppForm>(form: TForm) => FieldWrappers<FC, FormDataOf<TForm>>;
  useAppForm: <TFormData, TOnMount extends undefined | FormValidateOrFn<TFormData>, TOnChange extends undefined | FormValidateOrFn<TFormData>, TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnBlur extends undefined | FormValidateOrFn<TFormData>, TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnSubmit extends undefined | FormValidateOrFn<TFormData>, TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnDynamic extends undefined | FormValidateOrFn<TFormData>, TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>, TSubmitMeta>(props: FormOptions<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta>) => import("@tanstack/react-form").AppFieldExtendedReactFormApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta, FC, FMC>;
  useForm: <TFormData, TOnMount extends undefined | FormValidateOrFn<TFormData> = undefined, TOnChange extends undefined | FormValidateOrFn<TFormData> = undefined, TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData> = undefined, TOnBlur extends undefined | FormValidateOrFn<TFormData> = undefined, TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData> = undefined, TOnSubmit extends undefined | FormValidateOrFn<TFormData> = undefined, TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData> = undefined, TOnDynamic extends undefined | FormValidateOrFn<TFormData> = undefined, TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData> = undefined, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData> = undefined, TSubmitMeta = never>(options: UseFormOptions<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta>) => import("@tanstack/react-form").FormApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta> & import("@tanstack/react-form").ReactFormApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta> & NoInfer<FMC> & {
    AppField: import("@tanstack/react-form").FieldComponent<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta, NoInfer<FC>>;
    AppForm: import("react").ComponentType<import("react").PropsWithChildren<{}>>;
  } & FieldWrappers<FC, FormDataOf<import("@tanstack/react-form").AppFieldExtendedReactFormApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta, FC, FMC>>> & FMC;
  withFieldGroup: <TFieldGroupData, TSubmitMeta, TRenderProps extends object = {}>({ render, props, defaultValues }: import("@tanstack/react-form").WithFieldGroupProps<TFieldGroupData, FC, FMC, TSubmitMeta, TRenderProps>) => <TFormData, TFields extends import("@tanstack/react-form").DeepKeysOfType<TFormData, TFieldGroupData | null | undefined> | import("@tanstack/react-form").FieldsMap<TFormData, TFieldGroupData>, TOnMount extends undefined | FormValidateOrFn<TFormData>, TOnChange extends undefined | FormValidateOrFn<TFormData>, TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnBlur extends undefined | FormValidateOrFn<TFormData>, TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnSubmit extends undefined | FormValidateOrFn<TFormData>, TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnDynamic extends undefined | FormValidateOrFn<TFormData>, TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>, TFormSubmitMeta>(params: import("react").PropsWithChildren<NoInfer<TRenderProps> & {
    form: import("@tanstack/react-form").AppFieldExtendedReactFieldGroupApi<unknown, TFormData, string | import("@tanstack/react-form").FieldsMap<unknown, TFormData>, any, any, any, any, any, any, any, any, any, any, unknown extends TSubmitMeta ? TFormSubmitMeta : TSubmitMeta, FC, FMC> | import("@tanstack/react-form").AppFieldExtendedReactFormApi<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, unknown extends TSubmitMeta ? TFormSubmitMeta : TSubmitMeta, FC, FMC>;
    fields: TFields;
  }>) => ReturnType<import("react").FunctionComponent>;
  withForm: <TFormData, TOnMount extends undefined | FormValidateOrFn<TFormData>, TOnChange extends undefined | FormValidateOrFn<TFormData>, TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnBlur extends undefined | FormValidateOrFn<TFormData>, TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnSubmit extends undefined | FormValidateOrFn<TFormData>, TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnDynamic extends undefined | FormValidateOrFn<TFormData>, TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>, TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>, TSubmitMeta, TRenderProps extends object = {}>({ render, props }: import("@tanstack/react-form").WithFormProps<TFormData, TOnMount, TOnChange, TOnChangeAsync, TOnBlur, TOnBlurAsync, TOnSubmit, TOnSubmitAsync, TOnDynamic, TOnDynamicAsync, TOnServer, TSubmitMeta, FC, FMC, TRenderProps>) => import("react").FunctionComponent<import("react").PropsWithChildren<NoInfer<[unknown] extends [TRenderProps] ? any : TRenderProps> & {
    form: import("@tanstack/react-form").AppFieldExtendedReactFormApi<[unknown] extends [TFormData] ? any : TFormData, [FormValidateOrFn<TFormData> | undefined] extends [TOnMount] ? [TOnMount] extends [TOnMount & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnMount : TOnMount, [FormValidateOrFn<TFormData> | undefined] extends [TOnChange] ? [TOnChange] extends [TOnChange & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnChange : TOnChange, [FormValidateOrFn<TFormData> | undefined] extends [TOnChangeAsync] ? [TOnChangeAsync] extends [TOnChangeAsync & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnChangeAsync : TOnChangeAsync, [FormValidateOrFn<TFormData> | undefined] extends [TOnBlur] ? [TOnBlur] extends [TOnBlur & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnBlur : TOnBlur, [FormValidateOrFn<TFormData> | undefined] extends [TOnBlurAsync] ? [TOnBlurAsync] extends [TOnBlurAsync & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnBlurAsync : TOnBlurAsync, [FormValidateOrFn<TFormData> | undefined] extends [TOnSubmit] ? [TOnSubmit] extends [TOnSubmit & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnSubmit : TOnSubmit, [FormValidateOrFn<TFormData> | undefined] extends [TOnSubmitAsync] ? [TOnSubmitAsync] extends [TOnSubmitAsync & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnSubmitAsync : TOnSubmitAsync, [FormValidateOrFn<TFormData> | undefined] extends [TOnDynamic] ? [TOnDynamic] extends [TOnDynamic & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnDynamic : TOnDynamic, [FormValidateOrFn<TFormData> | undefined] extends [TOnDynamicAsync] ? [TOnDynamicAsync] extends [TOnDynamicAsync & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnDynamicAsync : TOnDynamicAsync, [FormValidateOrFn<TFormData> | undefined] extends [TOnServer] ? [TOnServer] extends [TOnServer & (FormValidateOrFn<TFormData> | undefined)] ? any : TOnServer : TOnServer, [unknown] extends [TSubmitMeta] ? any : TSubmitMeta, [unknown] extends [FC] ? any : FC, [unknown] extends [FMC] ? any : FMC>;
  }>>;
};
//#endregion
export { createZenoForm };