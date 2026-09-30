import {
  type ActionIssue,
  type ActionResult,
  FieldValidationError,
  toActionError,
} from "./action-result.ts"

/**
 * The slice of a schema `defineAction` needs: a throwing `parse`, plus the
 * Standard Schema `types` marker it reads the caller-facing input type from.
 * Zod 4 schemas satisfy it as they are; so does anything else that implements
 * Standard Schema and exposes `parse`.
 */
export interface ActionSchema<TInput, TOutput> {
  readonly "~standard": {
    readonly types?:
      | { readonly input: TInput; readonly output: TOutput }
      | undefined
  }
  parse(input: unknown): TOutput
}

/** What a request context must carry for `defineAction` to hand it over. */
export interface ActionContext<TDb> {
  readonly db: TDb
}

/** An action's body: the RLS-bound `db`, the parsed input, and the context. */
export type ActionHandler<
  TContext extends ActionContext<unknown>,
  TOutput,
  TResult,
> = (
  db: TContext["db"],
  input: TOutput,
  context: TContext
) => TResult | Promise<TResult>

/**
 * `defineAction(schema, handler)` returns the server action itself: an async
 * function that parses its argument, resolves the request context, then calls
 * `handler(db, input, context)`.
 */
export type DefineAction<TContext extends ActionContext<unknown>> = <
  TInput,
  TOutput,
  TResult,
>(
  schema: ActionSchema<TInput, TOutput>,
  handler: ActionHandler<TContext, TOutput, TResult>
) => (input: TInput) => Promise<TResult>

/**
 * Binds `defineAction` to a request-context resolver. Deliberately not a
 * `"use server"` module: it only returns a function, and the app file that
 * exports the result is the one that carries the directive.
 *
 * Input is parsed before the context is resolved, so a malformed call fails
 * without a session round trip, and the handler never sees an unparsed value.
 */
export function createDefineAction<TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>
): DefineAction<TContext> {
  return (schema, handler) => async (input) => {
    const parsed = schema.parse(input)
    const context = await getContext()

    return await handler(context.db, parsed, context)
  }
}

/**
 * The schema `defineFormAction` needs: the Standard Schema `validate`, which
 * reports failures as issues with paths instead of throwing. Zod 4 schemas
 * satisfy it as they are.
 */
export interface FormActionSchema<TInput, TOutput> {
  readonly "~standard": {
    readonly types?:
      | { readonly input: TInput; readonly output: TOutput }
      | undefined
    readonly validate: (
      value: unknown
    ) =>
      | FormActionSchemaResult<TOutput>
      | Promise<FormActionSchemaResult<TOutput>>
  }
}

type FormActionSchemaResult<TOutput> =
  | { readonly value: TOutput; readonly issues?: undefined }
  | { readonly issues: readonly ActionIssue[] }

/**
 * `defineFormAction(schema, handler)` is `defineAction` for a form: the action
 * resolves to an `ActionResult` instead of throwing on invalid input, so field
 * errors survive Next.js's production redaction of thrown messages.
 */
export type DefineFormAction<TContext extends ActionContext<unknown>> = <
  TInput,
  TOutput,
  TResult,
>(
  schema: FormActionSchema<TInput, TOutput>,
  handler: ActionHandler<TContext, TOutput, TResult>
) => (input: TInput) => Promise<ActionResult<Awaited<TResult>>>

/**
 * Binds `defineFormAction` to a request-context resolver. Same order as
 * `createDefineAction` (validate, then resolve the context, then run the
 * handler), but two failures come back as `{ ok: false, error }`: schema
 * issues, and a `FieldValidationError` thrown by the handler. Everything else
 * (an `UnauthenticatedError`, a database error) still throws.
 */
export function createDefineFormAction<TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>
): DefineFormAction<TContext> {
  return (schema, handler) => async (input) => {
    const parsed = await schema["~standard"].validate(input)
    if (parsed.issues) {
      return { error: toActionError(parsed.issues), ok: false }
    }
    const context = await getContext()

    try {
      return {
        data: await handler(context.db, parsed.value, context),
        ok: true,
      }
    } catch (error) {
      if (error instanceof FieldValidationError) {
        return { error: error.toActionError(), ok: false }
      }
      throw error
    }
  }
}
