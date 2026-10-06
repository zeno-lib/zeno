import { ActionError, ActionIssue, ActionResult } from "./action-result.mjs";
import { AnyFormApi } from "@tanstack/react-form";
//#region src/lib/submit-action.d.ts
declare function applyActionError(formApi: FormApiLike, error: ActionError): void;
type SchemaResult<TOutput> = {
  readonly value: TOutput;
  readonly issues?: undefined;
} | {
  readonly issues: readonly ActionIssue[];
};
type SubmitActionSchema<TOutput> = {
  readonly "~standard": {
    readonly validate: (value: unknown) => SchemaResult<TOutput> | Promise<SchemaResult<TOutput>>;
    readonly types?: {
      readonly input: unknown;
      readonly output: TOutput;
    } | undefined;
  };
};
type FormApiLike = Pick<AnyFormApi, "fieldInfo" | "getFieldMeta" | "getFieldValue" | "setErrorMap" | "setFieldMeta" | "store">;
type SubmitProps<TValues> = {
  readonly value: TValues;
  readonly formApi: FormApiLike & {
    reset: (values?: TValues, opts?: {
      keepDefaultValues?: boolean;
    }) => void;
  };
};
type Action<TInput, TData> = (input: TInput) => Promise<ActionResult<TData>>;
type ResetOption<TValues, TData> = "values" | ((data: TData) => TValues) | ([TData] extends [TValues] ? true : never);
type SubmitActionOptions<TValues, TData> = {
  /**
   * After a successful action, `formApi.reset(...)` so the saved values
   * become the pristine baseline (clears `isDirty` and the unsaved-changes
   * warning). Off by default.
   */
  reset?: ResetOption<TValues, TData>;
};
type SubmitActionSchemaOptions<TValues, TOutput, TData> = SubmitActionOptions<TValues, TData> & {
  /**
   * Parsed on the client before the call: `onSubmit` receives the form's
   * input values, and the action gets the schema's output. A failure is
   * applied to the form and the action is never called.
   */
  schema: SubmitActionSchema<TOutput>;
};
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
declare function submitAction<TValues, TOutput, TData>(props: SubmitProps<TValues>, action: Action<TOutput, TData>, options: SubmitActionSchemaOptions<TValues, TOutput, TData>): Promise<ActionResult<TData>>;
declare function submitAction<TValues, TData>(props: SubmitProps<TValues>, action: Action<NoInfer<TValues>, TData>, options?: SubmitActionOptions<TValues, TData>): Promise<ActionResult<TData>>;
//#endregion
export { type FormApiLike, type SubmitActionOptions, type SubmitActionSchema, applyActionError, submitAction };