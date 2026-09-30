import type { AnyFormApi } from "@tanstack/react-form"

import {
  type ActionError,
  type ActionIssue,
  type ActionResult,
  toActionError,
} from "./action-result"
import { applyValidationError } from "./apply-validation-error"
import { ValidationError } from "./validation-error"

// Write an action's failure onto the form. Field messages go through
// `applyValidationError`, so they live in `errorMap.onChange` and clear the
// moment the user edits that field (other fields keep theirs). A message
// keyed by a name no mounted field registered would be invisible yet still
// mark the form invalid, so it is folded into the form-level message instead,
// next to `formErrors` (one message per line).
//
// Why not `setErrorMap({ onServer: { form, fields } })`: the default
// `blur-then-change` logic never clears `onServer` on an edit, only on the
// next submit, and TanStack's `defaultValidationLogic` clears every field's
// `onServer` error on any single edit. Neither matches "clears when this field
// changes".
function applyActionError(formApi: FormApiLike, error: ActionError): void {
  const fields: Record<string, readonly string[]> = {}
  const formErrors = [...error.formErrors]
  const fieldInfo = formApi.fieldInfo as Record<
    string,
    { instance?: unknown } | undefined
  >
  for (const [name, messages] of Object.entries(error.fieldErrors)) {
    if (messages.length === 0) {
      continue
    }
    if (fieldInfo[name]?.instance) {
      fields[name] = messages
    } else {
      formErrors.push(...messages)
    }
  }
  applyValidationError(
    formApi as AnyFormApi,
    new ValidationError(
      fields,
      formErrors.length > 0 ? { formError: formErrors.join("\n") } : {}
    )
  )
}

type SchemaResult<TOutput> =
  | { readonly value: TOutput; readonly issues?: undefined }
  | { readonly issues: readonly ActionIssue[] }

// The Standard Schema slice `submitAction` reads: `validate` (never throws)
// and the output type. Zod 4, Valibot and ArkType schemas all fit.
type SubmitActionSchema<TOutput> = {
  readonly "~standard": {
    readonly validate: (
      value: unknown
    ) => SchemaResult<TOutput> | Promise<SchemaResult<TOutput>>
    readonly types?:
      | { readonly input: unknown; readonly output: TOutput }
      | undefined
  }
}

// The members of a form API the helpers touch. Typed as a slice rather than
// `AnyFormApi` so a concrete `FormApi<Values, …, never>` (what `onSubmit`
// receives) is assignable without a cast.
type FormApiLike = Pick<
  AnyFormApi,
  | "fieldInfo"
  | "getFieldMeta"
  | "getFieldValue"
  | "setErrorMap"
  | "setFieldMeta"
  | "store"
>

type SubmitProps<TValues> = {
  readonly value: TValues
  readonly formApi: FormApiLike & {
    reset: (values?: TValues, opts?: { keepDefaultValues?: boolean }) => void
  }
}

type Action<TInput, TData> = (input: TInput) => Promise<ActionResult<TData>>

// `true` rebases the form on the returned data (only offered when the data
// has the form's shape), `"values"` on the values just submitted, and a
// function on whatever it maps the data to.
type ResetOption<TValues, TData> =
  | "values"
  | ((data: TData) => TValues)
  | ([TData] extends [TValues] ? true : never)

type SubmitActionOptions<TValues, TData> = {
  /**
   * After a successful action, `formApi.reset(...)` so the saved values
   * become the pristine baseline (clears `isDirty` and the unsaved-changes
   * warning). Off by default.
   */
  reset?: ResetOption<TValues, TData>
}

type SubmitActionSchemaOptions<TValues, TOutput, TData> = SubmitActionOptions<
  TValues,
  TData
> & {
  /**
   * Parsed on the client before the call: `onSubmit` receives the form's
   * input values, and the action gets the schema's output. A failure is
   * applied to the form and the action is never called.
   */
  schema: SubmitActionSchema<TOutput>
}

/**
 * Call a server action from `onSubmit` and route its result back into the
 * form. Pass `onSubmit`'s own argument straight through:
 *
 * ```ts
 * onSubmit: (submit) => submitAction(submit, saveProfile, { reset: true, schema })
 * ```
 *
 * On `{ ok: false }` the field errors land on their fields (array paths like
 * `owners[0].percentage` included) and clear as each field is edited. On
 * `{ ok: true }` the form is optionally reset. Either way the result is
 * returned, so the caller can redirect or toast on `result.ok`. A thrown
 * error (network, auth, a bug) propagates unchanged.
 */
function submitAction<TValues, TOutput, TData>(
  props: SubmitProps<TValues>,
  action: Action<TOutput, TData>,
  options: SubmitActionSchemaOptions<TValues, TOutput, TData>
): Promise<ActionResult<TData>>
function submitAction<TValues, TData>(
  props: SubmitProps<TValues>,
  action: Action<NoInfer<TValues>, TData>,
  options?: SubmitActionOptions<TValues, TData>
): Promise<ActionResult<TData>>
async function submitAction(
  props: SubmitProps<unknown>,
  action: Action<unknown, unknown>,
  options: { reset?: unknown; schema?: SubmitActionSchema<unknown> } = {}
): Promise<ActionResult<unknown>> {
  const { formApi, value } = props
  let input: unknown = value

  if (options.schema) {
    const parsed = await options.schema["~standard"].validate(value)
    if (parsed.issues) {
      const error = toActionError(parsed.issues)
      applyActionError(formApi, error)
      return { error, ok: false }
    }
    input = parsed.value
  }

  const result = await action(input)
  if (!result.ok) {
    applyActionError(formApi, result.error)
    return result
  }

  const { reset } = options
  if (reset === true) {
    formApi.reset(result.data)
  } else if (reset === "values") {
    formApi.reset(value)
  } else if (typeof reset === "function") {
    formApi.reset((reset as (data: unknown) => unknown)(result.data))
  }
  return result
}

export type { FormApiLike, SubmitActionOptions, SubmitActionSchema }
export { applyActionError, submitAction }
