/* biome-ignore-all lint/performance/noBarrelFile: factory returns the wired form API. */
"use client"

import type {
  AnyFormApi,
  DeepKeys,
  FormAsyncValidateOrFn,
  FormOptions,
  FormValidateOrFn,
} from "@tanstack/react-form"
import { createFormHook } from "@tanstack/react-form"
import { type ComponentProps, type ReactNode, useMemo } from "react"
import { applyValidationError } from "./lib/apply-validation-error"
import { fieldContext, formContext } from "./lib/contexts"
import { deepMergeDefaults, extractZodDefaults } from "./lib/schema-defaults"
import { getRequiredPaths } from "./lib/schema-required"
import { useUnsavedChangesWarning } from "./lib/use-unsaved-changes-warning"
import { ValidationError } from "./lib/validation-error"
import { blurThenChangeLogic } from "./lib/validation-logic"
import {
  DEFAULT_VALIDATION_MODE,
  setFormZenoState,
  type ValidationMode,
} from "./lib/validation-modes"

// Structural shape of a Standard Schema (Zod, Valibot, ArkType, …). Avoids a
// direct dependency on `@standard-schema/spec`; runtime validation goes through
// TanStack Form's standard-schema integration unchanged.
type StandardSchema<T> = {
  readonly "~standard": {
    readonly validate: (value: unknown) => unknown
    readonly types?: { readonly input: T; readonly output: T }
  }
}

// Recursive partial that preserves arrays, dates, and other structural types as
// atomic — only plain object keys become optional. Relaxes `defaultValues` so
// users can omit fields covered by the schema's `.default(...)` values or the
// string/array auto-fill (see `lib/schema-defaults.ts`).
type PartialFormData<T> = T extends readonly unknown[]
  ? T
  : T extends Date | RegExp | ((...args: never[]) => unknown)
    ? T
    : T extends object
      ? { [K in keyof T]?: PartialFormData<T[K]> }
      : T

type ZenoFormExtras<TFormData> = {
  /**
   * If `true`, shipped fields skip rendering their inline `<FieldError>`
   * message. Fields still flip `data-invalid` / `aria-invalid`.
   */
  hideFieldErrors?: boolean
  /**
   * Show a `*` next to the label of every field the schema treats as required.
   * Defaults to `true`. Required-ness is detected by probing the schema.
   */
  requiredIndicator?: boolean
  /**
   * Warn the user before they navigate away with unsaved changes.
   * `"if-changed"` (or `true`) warns while values differ from defaults;
   * `"if-touched"` warns after any edit.
   */
  unsavedChangesWarning?: boolean | "if-changed" | "if-touched"
  /**
   * Initial values, relaxed to a deep partial so schema-provided defaults can
   * be omitted. See `lib/schema-defaults.ts`.
   */
  defaultValues?: PartialFormData<TFormData>
}

// Schema path — `schema` drives validation. `validators` (if present) selects
// *when* the schema fires; the matching `validationLogic` is wired internally.
type SchemaPathExtras<TFormData> = {
  schema: StandardSchema<TFormData>
  validators?: ValidationMode
  validationLogic?: never
}

// Manual path — no schema. `validators`/`validationLogic` keep native types.
type ManualPathExtras = {
  schema?: never
}

type SchemaFormOptions<
  TFormData,
  TOnMount extends undefined | FormValidateOrFn<TFormData>,
  TOnChange extends undefined | FormValidateOrFn<TFormData>,
  TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnBlur extends undefined | FormValidateOrFn<TFormData>,
  TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnSubmit extends undefined | FormValidateOrFn<TFormData>,
  TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnDynamic extends undefined | FormValidateOrFn<TFormData>,
  TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>,
  TSubmitMeta,
> = Omit<
  FormOptions<
    TFormData,
    TOnMount,
    TOnChange,
    TOnChangeAsync,
    TOnBlur,
    TOnBlurAsync,
    TOnSubmit,
    TOnSubmitAsync,
    TOnDynamic,
    TOnDynamicAsync,
    TOnServer,
    TSubmitMeta
  >,
  "defaultValues" | "validators" | "validationLogic"
> &
  SchemaPathExtras<TFormData> &
  ZenoFormExtras<TFormData>

type ManualFormOptions<
  TFormData,
  TOnMount extends undefined | FormValidateOrFn<TFormData>,
  TOnChange extends undefined | FormValidateOrFn<TFormData>,
  TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnBlur extends undefined | FormValidateOrFn<TFormData>,
  TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnSubmit extends undefined | FormValidateOrFn<TFormData>,
  TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnDynamic extends undefined | FormValidateOrFn<TFormData>,
  TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>,
  TSubmitMeta,
> = Omit<
  FormOptions<
    TFormData,
    TOnMount,
    TOnChange,
    TOnChangeAsync,
    TOnBlur,
    TOnBlurAsync,
    TOnSubmit,
    TOnSubmitAsync,
    TOnDynamic,
    TOnDynamicAsync,
    TOnServer,
    TSubmitMeta
  >,
  "defaultValues"
> &
  ManualPathExtras &
  ZenoFormExtras<TFormData>

type UseFormOptions<
  TFormData,
  TOnMount extends undefined | FormValidateOrFn<TFormData>,
  TOnChange extends undefined | FormValidateOrFn<TFormData>,
  TOnChangeAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnBlur extends undefined | FormValidateOrFn<TFormData>,
  TOnBlurAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnSubmit extends undefined | FormValidateOrFn<TFormData>,
  TOnSubmitAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnDynamic extends undefined | FormValidateOrFn<TFormData>,
  TOnDynamicAsync extends undefined | FormAsyncValidateOrFn<TFormData>,
  TOnServer extends undefined | FormAsyncValidateOrFn<TFormData>,
  TSubmitMeta,
> =
  | SchemaFormOptions<
      TFormData,
      TOnMount,
      TOnChange,
      TOnChangeAsync,
      TOnBlur,
      TOnBlurAsync,
      TOnSubmit,
      TOnSubmitAsync,
      TOnDynamic,
      TOnDynamicAsync,
      TOnServer,
      TSubmitMeta
    >
  | ManualFormOptions<
      TFormData,
      TOnMount,
      TOnChange,
      TOnChangeAsync,
      TOnBlur,
      TOnBlurAsync,
      TOnSubmit,
      TOnSubmitAsync,
      TOnDynamic,
      TOnDynamicAsync,
      TOnServer,
      TSubmitMeta
    >

function buildValidatorsFromSchema<TFormData>(
  schema: StandardSchema<TFormData>,
  mode: ValidationMode
) {
  switch (mode) {
    case "blur":
      return { onBlur: schema }
    case "submit":
      return { onSubmit: schema }
    default:
      return { onChange: schema }
  }
}

// --- typed field wrappers (generic over the injected field components) --------

type FormDataOf<F> = F extends { state: { values: infer V } } ? V : never

type AnyAppForm = {
  AppField: unknown
  state: { values: unknown }
}

// Loose validators/listeners types for the typed wrappers — name-aware
// validator typing from TanStack Form would collide with our per-field
// generics. Callers pass standard schemas or functions; both flow through to
// `<Field>` at runtime unchanged.
type AnyFieldValidators = {
  onMount?: unknown
  onChange?: unknown
  onChangeAsync?: unknown
  onChangeAsyncDebounceMs?: number
  onBlur?: unknown
  onBlurAsync?: unknown
  onBlurAsyncDebounceMs?: number
  onSubmit?: unknown
  onSubmitAsync?: unknown
  onSubmitAsyncDebounceMs?: number
  onDynamic?: unknown
  onDynamicAsync?: unknown
}

type AnyFieldListeners = {
  onChange?: unknown
  onChangeDebounceMs?: number
  onBlur?: unknown
  onBlurDebounceMs?: number
  onMount?: unknown
  onSubmit?: unknown
}

type WithValidators = {
  validators?: AnyFieldValidators
  listeners?: AnyFieldListeners
}

// biome-ignore lint/suspicious/noExplicitAny: field components accept arbitrary props.
type AnyComponent = React.ComponentType<any>

type FieldWrappers<FC extends Record<string, AnyComponent>, T> = {
  [K in keyof FC]: <N extends DeepKeys<T>>(
    props: ComponentProps<FC[K]> & { name: N } & WithValidators
  ) => ReactNode
}

type CreateZenoFormConfig<
  FC extends Record<string, AnyComponent>,
  FMC extends Record<string, AnyComponent>,
> = {
  fieldComponents: FC
  formComponents: FMC
}

/**
 * Build the wired Zeno form API from the caller's field + form components.
 *
 * The shadcn-style field components are dropped into the consumer's repo via the
 * registry and injected here, so `@zeno-lib/forms` (npm) stays UI-free. Returns
 * the `createFormHook` primitives plus the schema-aware `useForm` and the typed
 * `useAppFields` wrappers (prop types are inferred from the injected components).
 */
export function createZenoForm<
  FC extends Record<string, AnyComponent>,
  FMC extends Record<string, AnyComponent>,
>(config: CreateZenoFormConfig<FC, FMC>) {
  const { useAppForm, withFieldGroup, withForm } = createFormHook({
    fieldComponents: config.fieldComponents,
    fieldContext,
    formComponents: config.formComponents,
    formContext,
  })

  function useAppFields<TForm extends AnyAppForm>(form: TForm) {
    type T = FormDataOf<TForm>
    return useMemo(() => {
      const Field = form.AppField as React.ComponentType<{
        name: string
        validators?: AnyFieldValidators
        listeners?: AnyFieldListeners
        children: () => ReactNode
      }>
      const wrappers: Record<string, AnyComponent> = {}
      for (const key of Object.keys(config.fieldComponents)) {
        const Impl = config.fieldComponents[key] as AnyComponent
        wrappers[key] = ({
          name,
          validators,
          listeners,
          ...props
        }: {
          name: string
          validators?: AnyFieldValidators
          listeners?: AnyFieldListeners
        }) => (
          <Field listeners={listeners} name={name} validators={validators}>
            {() => <Impl {...props} />}
          </Field>
        )
      }
      return wrappers as FieldWrappers<FC, T>
    }, [form])
  }

  function useForm<
    TFormData,
    TOnMount extends undefined | FormValidateOrFn<TFormData> = undefined,
    TOnChange extends undefined | FormValidateOrFn<TFormData> = undefined,
    TOnChangeAsync extends
      | undefined
      | FormAsyncValidateOrFn<TFormData> = undefined,
    TOnBlur extends undefined | FormValidateOrFn<TFormData> = undefined,
    TOnBlurAsync extends
      | undefined
      | FormAsyncValidateOrFn<TFormData> = undefined,
    TOnSubmit extends undefined | FormValidateOrFn<TFormData> = undefined,
    TOnSubmitAsync extends
      | undefined
      | FormAsyncValidateOrFn<TFormData> = undefined,
    TOnDynamic extends undefined | FormValidateOrFn<TFormData> = undefined,
    TOnDynamicAsync extends
      | undefined
      | FormAsyncValidateOrFn<TFormData> = undefined,
    TOnServer extends undefined | FormAsyncValidateOrFn<TFormData> = undefined,
    TSubmitMeta = never,
  >(
    options: UseFormOptions<
      TFormData,
      TOnMount,
      TOnChange,
      TOnChangeAsync,
      TOnBlur,
      TOnBlurAsync,
      TOnSubmit,
      TOnSubmitAsync,
      TOnDynamic,
      TOnDynamicAsync,
      TOnServer,
      TSubmitMeta
    >
  ) {
    type NativeFormOptions = FormOptions<
      TFormData,
      TOnMount,
      TOnChange,
      TOnChangeAsync,
      TOnBlur,
      TOnBlurAsync,
      TOnSubmit,
      TOnSubmitAsync,
      TOnDynamic,
      TOnDynamicAsync,
      TOnServer,
      TSubmitMeta
    >
    type NativeValidators = NativeFormOptions["validators"]
    type NativeValidationLogic = NativeFormOptions["validationLogic"]

    const {
      schema,
      validators: validatorsInput,
      validationLogic: userValidationLogic,
      hideFieldErrors = false,
      requiredIndicator = true,
      unsavedChangesWarning = false,
      defaultValues: userDefaultValues,
      onSubmit: userOnSubmit,
      ...rest
    } = options as Omit<NativeFormOptions, "defaultValues"> & {
      schema?: StandardSchema<TFormData>
      validators?: ValidationMode | NativeValidators
      validationLogic?: NativeValidationLogic
      defaultValues?: PartialFormData<TFormData>
      hideFieldErrors?: boolean
      requiredIndicator?: boolean
      unsavedChangesWarning?: boolean | "if-changed" | "if-touched"
    }

    let schemaMode: ValidationMode | undefined
    let resolvedValidators: NativeValidators | undefined
    let resolvedValidationLogic: NativeValidationLogic | undefined

    if (schema === undefined) {
      schemaMode = undefined
      resolvedValidators =
        typeof validatorsInput === "object" && validatorsInput !== null
          ? (validatorsInput as NativeValidators)
          : undefined
      resolvedValidationLogic = userValidationLogic
    } else {
      const mode: ValidationMode =
        typeof validatorsInput === "string"
          ? (validatorsInput as ValidationMode)
          : DEFAULT_VALIDATION_MODE
      schemaMode = mode
      resolvedValidators = buildValidatorsFromSchema(
        schema,
        mode
      ) as unknown as NativeValidators
      resolvedValidationLogic =
        mode === "blur-then-change"
          ? (blurThenChangeLogic as unknown as NativeValidationLogic)
          : undefined
    }

    const wrappedOnSubmit = userOnSubmit
      ? ((async (props: { formApi: AnyFormApi; value: TFormData }) => {
          try {
            await (
              userOnSubmit as unknown as (
                p: typeof props
              ) => unknown | Promise<unknown>
            )(props)
          } catch (error) {
            if (error instanceof ValidationError) {
              applyValidationError(props.formApi, error)
              return
            }
            throw error
          }
        }) as typeof userOnSubmit)
      : undefined

    const requiredFields = useMemo(
      () =>
        schema && requiredIndicator
          ? getRequiredPaths(schema as Parameters<typeof getRequiredPaths>[0])
          : new Set<string>(),
      [schema, requiredIndicator]
    )

    const schemaDefaults = useMemo(
      () =>
        schema
          ? extractZodDefaults(
              schema as Parameters<typeof extractZodDefaults>[0]
            )
          : undefined,
      [schema]
    )

    const mergedDefaultValues = useMemo(
      () =>
        schemaDefaults
          ? (deepMergeDefaults(
              schemaDefaults,
              userDefaultValues as Record<string, unknown> | undefined
            ) as typeof userDefaultValues)
          : userDefaultValues,
      [schemaDefaults, userDefaultValues]
    )

    const form = useAppForm<
      TFormData,
      TOnMount,
      TOnChange,
      TOnChangeAsync,
      TOnBlur,
      TOnBlurAsync,
      TOnSubmit,
      TOnSubmitAsync,
      TOnDynamic,
      TOnDynamicAsync,
      TOnServer,
      TSubmitMeta
    >({
      ...rest,
      ...(mergedDefaultValues === undefined
        ? {}
        : { defaultValues: mergedDefaultValues }),
      ...(wrappedOnSubmit ? { onSubmit: wrappedOnSubmit } : {}),
      ...(resolvedValidators ? { validators: resolvedValidators } : {}),
      ...(resolvedValidationLogic
        ? { validationLogic: resolvedValidationLogic }
        : {}),
    } as NativeFormOptions)

    setFormZenoState(form, {
      hideFieldErrors,
      requiredFields,
      requiredIndicator,
      ...(schemaMode === undefined ? {} : { validation: schemaMode }),
    })

    useUnsavedChangesWarning(form, unsavedChangesWarning)

    const fields = useAppFields(form)
    return useMemo(
      () => Object.assign(form, fields, config.formComponents),
      [form, fields]
    )
  }

  return { useAppFields, useAppForm, useForm, withFieldGroup, withForm }
}
