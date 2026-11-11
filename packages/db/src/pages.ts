// What a paged read takes and returns, shared by `findPage` (`./query`) and
// the `paged` option of `defineQuery` (`./next`). Plain TypeScript: no Zod at
// runtime, since Zod is only an optional peer.
import type { ActionSchema } from "./define-action.ts"

/** Which rows a paged read returns: `limit` rows, after skipping `offset`. */
export interface PageInput {
  readonly limit: number
  readonly offset: number
}

/**
 * A paged read's result: its items, how many rows match in all, and whether
 * more follow this page.
 */
export interface Page<TItem> {
  readonly hasMore: boolean
  readonly items: TItem[]
  readonly total: number
}

/** The bounds of a paged read's `limit` and `offset`. */
export interface PageOptions {
  /** The `limit` when the caller sends none. 20 by default, or `maxLimit` when lower. */
  readonly defaultLimit?: number
  /** The largest `limit` the schema accepts. 50 by default. */
  readonly maxLimit?: number
  /** The largest `offset` the schema accepts. 10,000 by default. */
  readonly maxOffset?: number
}

export type PageLimits = Required<PageOptions>

const DEFAULT_PAGE_LIMITS: PageLimits = {
  defaultLimit: 20,
  maxLimit: 50,
  maxOffset: 10_000,
}

/** `paged: true` or `paged: { … }` as the limits it stands for. */
export const toPageLimits = (paged: true | PageOptions): PageLimits => {
  const options = paged === true ? {} : paged
  const maxLimit = options.maxLimit ?? DEFAULT_PAGE_LIMITS.maxLimit
  const limits = {
    defaultLimit:
      options.defaultLimit ??
      Math.min(DEFAULT_PAGE_LIMITS.defaultLimit, maxLimit),
    maxLimit,
    maxOffset: options.maxOffset ?? DEFAULT_PAGE_LIMITS.maxOffset,
  }
  const { defaultLimit, maxOffset } = limits
  if (
    !(
      isInteger(defaultLimit, 1, maxLimit) &&
      isInteger(maxLimit, 1, Number.MAX_SAFE_INTEGER) &&
      isInteger(maxOffset, 0, Number.MAX_SAFE_INTEGER)
    )
  ) {
    throw new RangeError(
      `paged needs whole numbers with 1 ≤ defaultLimit ≤ maxLimit and maxOffset ≥ 0, got ${JSON.stringify(limits)}`
    )
  }
  return limits
}

/** What a paged read's description says of its result and how to page. */
export const describePage = ({ defaultLimit, maxLimit }: PageLimits) =>
  `Returns items (${defaultLimit} by default, at most ${maxLimit}), total (how many rows match in all) and hasMore (whether more rows follow this page). For the next page, call again with offset set to this offset plus limit.`

/** `items` mapped one by one, `total` and `hasMore` kept. */
export const mapPage = <TItem, TNext>(
  page: Page<TItem>,
  toItem: (item: TItem) => TNext
): Page<TNext> => ({ ...page, items: page.items.map(toItem) })

const isInteger = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) &&
  (value as number) >= min &&
  (value as number) <= max

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

type Issue = { readonly message: string; readonly path?: readonly string[] }

type Validation<TValue> =
  | { readonly issues?: undefined; readonly value: TValue }
  | { readonly issues: readonly Issue[] }

type JsonSchemaConverter = (options: {
  readonly target: string
}) => Record<string, unknown>

/** The parts of a Standard Schema with Standard JSON Schema a wrapper reads. */
type StandardParts = {
  readonly jsonSchema?: {
    readonly input: JsonSchemaConverter
    readonly output: JsonSchemaConverter
  }
  readonly validate?: (
    value: unknown
  ) => Validation<unknown> | Promise<Validation<unknown>>
}

/**
 * `limit` and `offset` read off the input, with the problems found. A missing
 * or `null` one takes its default: a model often sends `null` for an optional
 * argument it means to leave out.
 */
const readPage = (value: Record<string, unknown>, limits: PageLimits) => {
  const limit = value.limit ?? limits.defaultLimit
  const offset = value.offset ?? 0
  const issues: Issue[] = []
  if (!isInteger(limit, 1, limits.maxLimit)) {
    issues.push({
      message: `limit must be a whole number from 1 to ${limits.maxLimit}`,
      path: ["limit"],
    })
  }
  if (!isInteger(offset, 0, limits.maxOffset)) {
    issues.push({
      message: `offset must be a whole number from 0 to ${limits.maxOffset}`,
      path: ["offset"],
    })
  }
  return { issues, page: { limit, offset } as PageInput }
}

/** The input without `limit` and `offset`, for the read's own schema. */
const withoutPage = (value: unknown) => {
  if (!isRecord(value)) {
    return value
  }
  const { limit: _limit, offset: _offset, ...rest } = value
  return rest
}

const pageProperties = ({ defaultLimit, maxLimit, maxOffset }: PageLimits) => ({
  limit: {
    default: defaultLimit,
    description: `How many rows to return, ${defaultLimit} by default, at most ${maxLimit}`,
    maximum: maxLimit,
    minimum: 1,
    type: "integer",
  },
  offset: {
    default: 0,
    description:
      "How many rows to skip, to page past the first limit: the next page starts at this offset plus the limit",
    maximum: maxOffset,
    minimum: 0,
    type: "integer",
  },
})

const DEFS_REF = "#/$defs/"

/**
 * The object schema a JSON Schema describes: itself, or the `$defs` entry its
 * top-level `$ref` names, as Zod writes a schema given an `id` in `.meta()`.
 */
const resolveObject = (schema: Record<string, unknown>) => {
  const ref = schema.$ref
  if (typeof ref !== "string" || !ref.startsWith(DEFS_REF)) {
    return schema
  }
  const defs = schema.$defs as
    | Record<string, Record<string, unknown>>
    | undefined
  return defs?.[ref.slice(DEFS_REF.length)] ?? schema
}

// The JSON Schema an AI app reads: the read's own object schema, plus `limit`
// and `offset`, both always present in the output. It converts only when a
// tool list asks, so a schema JSON Schema can't express (a `Date`) still
// works on a screen.
const withPageProperties =
  (
    convert: JsonSchemaConverter,
    limits: PageLimits,
    io: "input" | "output"
  ): JsonSchemaConverter =>
  (options) => {
    const converted = convert(options)
    const target = resolveObject(converted)
    const { $ref: _ref, ...rest } = converted
    // Keeps `$defs`, which the object's own properties may still point into.
    const schema = target === converted ? converted : { ...rest, ...target }
    const properties = schema.properties as Record<string, unknown> | undefined
    if (schema.type !== "object" || !properties) {
      throw new TypeError("paged needs an object schema")
    }
    if ("limit" in properties || "offset" in properties) {
      throw new TypeError(
        "A paged read's schema takes neither limit nor offset: paged adds both"
      )
    }
    const required = (schema.required as string[] | undefined) ?? []
    return {
      ...schema,
      properties: { ...properties, ...pageProperties(limits) },
      ...(io === "output"
        ? { required: [...required, "limit", "offset"] }
        : {}),
    }
  }

/** The wrapped schema's validation, as issues even when it only throws. */
const validateOwn = async (
  schema: ActionSchema<unknown, unknown>,
  standard: StandardParts,
  input: unknown
): Promise<Validation<unknown>> => {
  if (standard.validate) {
    return await standard.validate(input)
  }
  try {
    return { value: schema.parse(input) }
  } catch (error) {
    return {
      issues: [
        { message: error instanceof Error ? error.message : String(error) },
      ],
    }
  }
}

/**
 * A paged read's schema: the read's own schema, which never sees `limit` or
 * `offset`, plus both, checked against `limits` and defaulted. It keeps the
 * Standard Schema and Standard JSON Schema of the schema it wraps, so a tool
 * list still describes it to a model.
 */
export function withPageSchema<TInput, TOutput>(
  schema: ActionSchema<TInput, TOutput>,
  limits: PageLimits
): ActionSchema<TInput & Partial<PageInput>, TOutput & PageInput> {
  const standard = schema["~standard"] as StandardParts
  const { jsonSchema } = standard
  const parse = (input: unknown) => {
    const { issues, page } = readPage(isRecord(input) ? input : {}, limits)
    if (issues.length > 0) {
      throw new RangeError(issues.map(({ message }) => message).join("; "))
    }
    return { ...(schema.parse(withoutPage(input)) as object), ...page }
  }
  const validate = async (input: unknown): Promise<Validation<unknown>> => {
    const { issues, page } = readPage(isRecord(input) ? input : {}, limits)
    const own = await validateOwn(schema, standard, withoutPage(input))
    if (own.issues || issues.length > 0) {
      return { issues: [...issues, ...(own.issues ?? [])] }
    }
    return { value: { ...(own.value as object), ...page } }
  }
  return {
    "~standard": {
      ...schema["~standard"],
      // Not the wrapped schema's vendor: a library that sees "zod" reaches for
      // Zod internals this wrapper doesn't have.
      vendor: "zeno-lib",
      ...(jsonSchema
        ? {
            jsonSchema: {
              input: withPageProperties(jsonSchema.input, limits, "input"),
              output: withPageProperties(jsonSchema.output, limits, "output"),
            },
          }
        : {}),
      validate,
    },
    parse,
  } as unknown as ActionSchema<TInput & Partial<PageInput>, TOutput & PageInput>
}
