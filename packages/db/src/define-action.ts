import {
  type ActionIssue,
  type ActionResult,
  FieldValidationError,
  toActionError,
} from "./action-result.ts"
import {
  describePage,
  type Page,
  type PageInput,
  type PageLimits,
  type PageOptions,
  toPageLimits,
  withPageSchema,
} from "./pages.ts"

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
  parse: (input: unknown) => TOutput
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
 * What an action resolves to: the handler's result, with `undefined` (and
 * `void`) replaced by `null`.
 */
export type ActionValue<TResult> = undefined extends TResult
  ? Exclude<Exclude<TResult, undefined>, void> | null
  : TResult

/** A field's value as an approval step shows it, before and after a write. */
export type ChangeValue = string | number | boolean | null

/**
 * What a write is about to change, for an approval step to show before it
 * runs: the record as the user knows it, and each field it moves, old → new.
 * A field the write creates has `from: null`.
 */
export interface ChangeDescription {
  readonly changes: readonly {
    readonly field: string
    readonly from: ChangeValue
    readonly to: ChangeValue
  }[]
  /** The record, named the way the user knows it: "Invoice INV-0042 (Acme)". */
  readonly entity: string
}

/**
 * Reads, under the caller's RLS, what a write would change. The definition's
 * `describe` calls it with the parsed input, before the write runs, on a
 * read-only `db`. Wrap several reads in `db.transaction` for one snapshot.
 */
export type DescribeChange<TContext extends ActionContext<unknown>, TOutput> = (
  db: TContext["db"],
  input: TOutput,
  context: TContext
) => ChangeDescription | Promise<ChangeDescription>

/**
 * The object form of `defineQuery`: the positional pair, plus the `name` and
 * `description` a tool list shows a model. The name is the tool's: 1 to 64
 * letters, digits, `_` or `-`.
 */
export interface QueryOptions<
  TContext extends ActionContext<unknown>,
  TInput,
  TOutput,
  TResult,
> {
  description: string
  name: string
  run: ActionHandler<TContext, TOutput, TResult>
  schema: ActionSchema<TInput, TOutput>
}

/**
 * The object form of `defineQuery` for a paged read: `paged` adds `limit` and
 * `offset` to `schema`, which must be an object schema without them, and `run`
 * receives both with the rest of the input and resolves to a `Page`.
 * `paged: true` takes the default bounds.
 */
export interface PagedQueryOptions<
  TContext extends ActionContext<unknown>,
  TInput,
  TOutput,
  TResult extends Page<unknown>,
> extends Omit<QueryOptions<TContext, TInput, TOutput, TResult>, "run"> {
  paged: true | PageOptions
  run: ActionHandler<TContext, TOutput & PageInput, TResult>
}

/** The object form of `defineAction`: a query's fields, plus `describeChange`. */
export interface ActionOptions<
  TContext extends ActionContext<unknown>,
  TInput,
  TOutput,
  TResult,
> extends QueryOptions<TContext, TInput, TOutput, TResult> {
  describeChange?: DescribeChange<TContext, TOutput>
}

/** The object form of `defineFormAction`, with its validating schema. */
export interface FormActionOptions<
  TContext extends ActionContext<unknown>,
  TInput,
  TOutput,
  TResult,
> {
  describeChange?: DescribeChange<TContext, TOutput>
  description: string
  name: string
  run: ActionHandler<TContext, TOutput, TResult>
  schema: FormActionSchema<TInput, TOutput>
}

/**
 * What the object form keeps on the export's `definition` key, so a tool list
 * can describe it to a model and run it for a caller of its own. `invoke`
 * behaves exactly like the export, with the context passed in instead of the
 * request's: parse, then `run`, then `undefined` → `null`. A query runs in a
 * read-only transaction, so a `run` that writes fails instead of skipping the
 * approval `readOnly` lets a host skip.
 */
export interface QueryDefinition<
  TContext extends ActionContext<unknown>,
  TInput,
  TOutput,
  TResult,
> extends QueryOptions<TContext, TInput, TOutput, TResult> {
  invoke: (input: unknown, context: TContext) => Promise<ActionValue<TResult>>
  readonly kind: "query"
  /**
   * The bounds of `limit` and `offset` on a paged read, which its schema
   * already checks; absent on any other.
   */
  readonly paged?: PageLimits
  readonly readOnly: true
}

/**
 * `QueryDefinition` for a write. A write always needs the user's approval:
 * `describe` parses the input as `invoke` would, then resolves to what
 * `describeChange` reads, or `null` without one.
 */
export interface ActionDefinition<
  TContext extends ActionContext<unknown>,
  TInput,
  TOutput,
  TResult,
> extends ActionOptions<TContext, TInput, TOutput, TResult> {
  describe: (
    input: unknown,
    context: TContext
  ) => Promise<ChangeDescription | null>
  invoke: (input: unknown, context: TContext) => Promise<ActionValue<TResult>>
  readonly kind: "action"
  readonly readOnly: false
}

/**
 * `ActionDefinition` for a form write: `invoke` resolves to an `ActionResult`,
 * and `describe` throws a `FieldValidationError` for input the schema refuses.
 */
export interface FormActionDefinition<
  TContext extends ActionContext<unknown>,
  TInput,
  TOutput,
  TResult,
> extends FormActionOptions<TContext, TInput, TOutput, TResult> {
  describe: (
    input: unknown,
    context: TContext
  ) => Promise<ChangeDescription | null>
  invoke: (
    input: unknown,
    context: TContext
  ) => Promise<ActionResult<Awaited<TResult>>>
  readonly kind: "formAction"
  readonly readOnly: false
}

/**
 * An export built from the object form. The definition sits on its own key
 * because a function's `name` is read-only; the key is non-enumerable and
 * survives `"use server"` for the server code that imports the export.
 */
export type Defined<TFunction, TDefinition> = TFunction & {
  readonly definition: TDefinition
}

/**
 * A write definition built with a `describeChange`, typed as having one. A
 * tool list that must show every change before it runs (`@zeno-lib/ai`)
 * requires it.
 */
export type Described<TDefinition extends { describeChange?: unknown }> =
  TDefinition & {
    readonly describeChange: NonNullable<TDefinition["describeChange"]>
  }

/**
 * `defineAction(schema, handler)` returns the server action itself: an async
 * function that parses its argument, resolves the request context, then calls
 * `handler(db, input, context)`. A handler that resolves to `undefined`, such
 * as a Drizzle `findFirst` that matched no row, makes the action resolve to
 * `null`, because TanStack Query rejects a query whose function resolves to
 * `undefined`.
 *
 * `defineAction({ name, description, schema, run, describeChange })` returns
 * the same action, with an `ActionDefinition` on its `definition` key.
 */
export interface DefineAction<TContext extends ActionContext<unknown>> {
  <TInput, TOutput, TResult>(
    schema: ActionSchema<TInput, TOutput>,
    handler: ActionHandler<TContext, TOutput, TResult>
  ): (input: TInput) => Promise<ActionValue<TResult>>
  <TInput, TOutput, TResult>(
    options: ActionOptions<TContext, TInput, TOutput, TResult> & {
      describeChange: DescribeChange<TContext, TOutput>
    }
  ): Defined<
    (input: TInput) => Promise<ActionValue<TResult>>,
    Described<ActionDefinition<TContext, TInput, TOutput, TResult>>
  >
  <TInput, TOutput, TResult>(
    options: ActionOptions<TContext, TInput, TOutput, TResult>
  ): Defined<
    (input: TInput) => Promise<ActionValue<TResult>>,
    ActionDefinition<TContext, TInput, TOutput, TResult>
  >
}

/**
 * `defineAction` for a read. The object form,
 * `defineQuery({ name, description, schema, run })`, marks it read-only.
 */
export interface DefineQuery<TContext extends ActionContext<unknown>> {
  <TInput, TOutput, TResult>(
    schema: ActionSchema<TInput, TOutput>,
    handler: ActionHandler<TContext, TOutput, TResult>
  ): (input: TInput) => Promise<ActionValue<TResult>>
  <TInput, TOutput, TResult extends Page<unknown>>(
    options: PagedQueryOptions<TContext, TInput, TOutput, TResult>
  ): Defined<
    (input: TInput & Partial<PageInput>) => Promise<ActionValue<TResult>>,
    QueryDefinition<
      TContext,
      TInput & Partial<PageInput>,
      TOutput & PageInput,
      TResult
    > & { readonly paged: PageLimits }
  >
  // `paged?: undefined`, or TypeScript's first, stricter pass over the
  // overloads picks this one for `paged: BOUNDS` with `BOUNDS` declared
  // `as const`, which lacks `PageOptions`' other keys, and `run` loses
  // `limit` and `offset`.
  <TInput, TOutput, TResult>(
    options: QueryOptions<TContext, TInput, TOutput, TResult> & {
      readonly paged?: undefined
    }
  ): Defined<
    (input: TInput) => Promise<ActionValue<TResult>>,
    QueryDefinition<TContext, TInput, TOutput, TResult>
  >
}

// The tool name rules of MCP and of the model APIs, intersected.
const DEFINITION_NAME = /^[A-Za-z0-9_-]{1,64}$/u

// Checks the name when the module loads, rather than when a tool list first
// reaches a model, and puts the definition on its non-enumerable key.
function withDefinition<TFunction extends object, TDefinition>(
  action: TFunction,
  definition: TDefinition & { name: string }
): Defined<TFunction, TDefinition> {
  if (!DEFINITION_NAME.test(definition.name)) {
    throw new TypeError(
      `"${definition.name}" is not a valid definition name: use 1 to 64 letters, digits, "_" or "-"`
    )
  }
  return Object.defineProperty(action, "definition", {
    value: Object.freeze(definition),
  }) as Defined<TFunction, TDefinition>
}

// Parse, then resolve the context, then run: the order both the export and
// `invoke` follow.
function createRunner<
  TContext extends ActionContext<unknown>,
  TOutput,
  TResult,
>(
  schema: ActionSchema<unknown, TOutput>,
  handler: ActionHandler<TContext, TOutput, TResult>
) {
  return async (
    input: unknown,
    getContext: () => TContext | Promise<TContext>
  ): Promise<ActionValue<TResult>> => {
    const parsed = schema.parse(input)
    const context = await getContext()
    const result = await handler(context.db, parsed, context)

    return (result ?? null) as ActionValue<TResult>
  }
}

type DefinitionKind = "action" | "formAction" | "query"

type AnySchema = ActionSchema<unknown, unknown> &
  FormActionSchema<unknown, unknown>

type AnyOptions<TContext extends ActionContext<unknown>> = Omit<
  ActionOptions<TContext, unknown, unknown, unknown>,
  "schema"
> & { paged?: true | PageOptions; schema: AnySchema }

// What sets the builders apart: how they parse and how they run.
const PARSERS = {
  action: (schema: AnySchema, input: unknown) => schema.parse(input),
  formAction: async (schema: AnySchema, input: unknown) => {
    const parsed = await schema["~standard"].validate(input)
    if (parsed.issues) {
      const { fieldErrors, formErrors } = toActionError(parsed.issues)
      throw new FieldValidationError(fieldErrors, { formErrors })
    }
    return parsed.value
  },
  query: (schema: AnySchema, input: unknown) => schema.parse(input),
}

const RUNNERS = {
  action: createRunner,
  formAction: createFormRunner,
  query: createRunner,
}

function bindDefinition<TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>,
  kind: DefinitionKind,
  readOnlyContext: (context: TContext) => TContext
) {
  const createRun = RUNNERS[kind] as (
    schema: AnySchema,
    handler: ActionHandler<TContext, unknown, unknown>
  ) => (
    input: unknown,
    getContext: () => TContext | Promise<TContext>
  ) => Promise<unknown>
  const parse = PARSERS[kind]

  return (
    schemaOrOptions: AnySchema | AnyOptions<TContext>,
    handler?: ActionHandler<TContext, unknown, unknown>
  ) => {
    if (handler) {
      const run = createRun(schemaOrOptions as AnySchema, handler)
      return (input: unknown) => run(input, getContext)
    }

    const { paged: pagedOption, ...options } =
      schemaOrOptions as AnyOptions<TContext>
    const paged =
      kind === "query" && pagedOption ? toPageLimits(pagedOption) : undefined
    if (paged) {
      options.schema = withPageSchema(options.schema, paged) as AnySchema
      options.description = `${options.description} ${describePage(paged)}`
    }
    const run = createRun(options.schema, options.run)
    const prepare =
      kind === "query" ? readOnlyContext : (context: TContext) => context
    const describeChange = kind === "query" ? undefined : options.describeChange
    const describe = async (input: unknown, context: TContext) => {
      if (!describeChange) {
        return null
      }
      const parsed = await parse(options.schema, input)
      const readOnly = readOnlyContext(context)
      return describeChange(readOnly.db, parsed, readOnly)
    }

    return withDefinition(
      async (input: unknown) =>
        run(input, async () => prepare(await getContext())),
      {
        ...(describeChange ? { describeChange } : {}),
        ...(kind === "query" ? {} : { describe }),
        description: options.description,
        invoke: (input: unknown, context: TContext) =>
          run(input, () => prepare(context)),
        kind,
        name: options.name,
        ...(paged ? { paged } : {}),
        readOnly: kind === "query",
        run: options.run,
        schema: options.schema,
      }
    )
  }
}

/**
 * Binds `defineAction` to a request-context resolver. Deliberately not a
 * `"use server"` module: it only returns a function, and the app file that
 * exports the result is the one that carries the directive.
 *
 * Input is parsed before the context is resolved, so a malformed call fails
 * without a session round trip, and the handler never sees an unparsed value.
 * `readOnlyContext` gives a context's read-only twin, which `describe` reads
 * through.
 */
export function createDefineAction<TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>,
  readOnlyContext: (context: TContext) => TContext
): DefineAction<TContext> {
  return bindDefinition(
    getContext,
    "action",
    readOnlyContext
  ) as DefineAction<TContext>
}

/**
 * Binds `defineQuery` to a request-context resolver, as `createDefineAction`.
 * The object form runs every call through `readOnlyContext`.
 */
export function createDefineQuery<TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>,
  readOnlyContext: (context: TContext) => TContext
): DefineQuery<TContext> {
  return bindDefinition(
    getContext,
    "query",
    readOnlyContext
  ) as DefineQuery<TContext>
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
 * errors survive Next.js's production redaction of thrown messages. The object
 * form puts a `FormActionDefinition` on the action's `definition` key.
 */
export interface DefineFormAction<TContext extends ActionContext<unknown>> {
  <TInput, TOutput, TResult>(
    schema: FormActionSchema<TInput, TOutput>,
    handler: ActionHandler<TContext, TOutput, TResult>
  ): (input: TInput) => Promise<ActionResult<Awaited<TResult>>>
  <TInput, TOutput, TResult>(
    options: FormActionOptions<TContext, TInput, TOutput, TResult> & {
      describeChange: DescribeChange<TContext, TOutput>
    }
  ): Defined<
    (input: TInput) => Promise<ActionResult<Awaited<TResult>>>,
    Described<FormActionDefinition<TContext, TInput, TOutput, TResult>>
  >
  <TInput, TOutput, TResult>(
    options: FormActionOptions<TContext, TInput, TOutput, TResult>
  ): Defined<
    (input: TInput) => Promise<ActionResult<Awaited<TResult>>>,
    FormActionDefinition<TContext, TInput, TOutput, TResult>
  >
}

/**
 * Binds `defineFormAction` to a request-context resolver. Same order as
 * `createDefineAction` (validate, then resolve the context, then run the
 * handler), but two failures come back as `{ ok: false, error }`: schema
 * issues, and a `FieldValidationError` thrown by the handler. Everything else
 * (an `UnauthenticatedError`, a database error) still throws.
 */
export function createDefineFormAction<TContext extends ActionContext<unknown>>(
  getContext: () => Promise<TContext>,
  readOnlyContext: (context: TContext) => TContext
): DefineFormAction<TContext> {
  return bindDefinition(
    getContext,
    "formAction",
    readOnlyContext
  ) as DefineFormAction<TContext>
}

function createFormRunner<
  TContext extends ActionContext<unknown>,
  TOutput,
  TResult,
>(
  schema: FormActionSchema<unknown, TOutput>,
  handler: ActionHandler<TContext, TOutput, TResult>
) {
  return async (
    input: unknown,
    getContext: () => TContext | Promise<TContext>
  ): Promise<ActionResult<Awaited<TResult>>> => {
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
