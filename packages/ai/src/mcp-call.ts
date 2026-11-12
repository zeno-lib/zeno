import type { StandardSchemaV1 } from "@standard-schema/spec"
import type { ToolSchema } from "./agent-tools.ts"

/** How a tool call ended: what the tool returned, or why it failed. */
export type McpToolOutcome =
  | {
      readonly ok: true
      /**
       * What `definition.invoke` returned, before it became JSON text. For a
       * write's propose tool, `{ change, proposalId }`: what it showed the
       * user, and the proposal's id.
       */
      readonly result: unknown
    }
  | {
      readonly ok: false
      /**
       * What the tool threw, or a `ToolInputError` when its schema refused
       * the input and it never ran. A schema that throws is reported with
       * what it threw. `apply_change` reports a proposal it refused with a
       * `ProposalRefusedError`.
       */
      readonly error: unknown
    }

/**
 * One `tools/call` of a served tool, as `onToolCall` receives it: what was
 * asked, how it ended and how long it took.
 */
export type McpToolCall = McpToolOutcome & {
  /** The tool's name: its definition's `name`, or `apply_change`. */
  readonly name: string
  /**
   * The input as the tool's schema parsed it, defaults filled in (a paged
   * read's `limit` and `offset`). When the schema refused it, the arguments
   * the client sent. For `apply_change`, once its proposal verifies,
   * `{ proposalId, tool, input }`: the write it applies, and the input the
   * model sent that write, unparsed.
   */
  readonly input: unknown
  /** From the input's validation to the tool's answer, in milliseconds. */
  readonly durationMs: number
}

/**
 * What `onToolCall` reports when a tool's schema refuses the input: the tool
 * never ran, and the client got the MCP SDK's `Input validation error` for the
 * same issues.
 */
export class ToolInputError extends Error {
  override readonly name = "ToolInputError"
  /** The schema's issues, as Standard Schema reports them. */
  readonly issues: readonly StandardSchemaV1.Issue[]

  constructor(tool: string, issues: readonly StandardSchemaV1.Issue[]) {
    super(
      `Invalid arguments for tool ${tool}: ${issues.map(describeIssue).join(", ")}`
    )
    this.issues = issues
  }
}

// `limit: Too big`: the field first, so a stored message says which one.
const describeIssue = ({ message, path = [] }: StandardSchemaV1.Issue) => {
  const field = path
    .map((segment) =>
      String(typeof segment === "object" ? segment.key : segment)
    )
    .join(".")
  return field ? `${field}: ${message}` : message
}

// What a served tool's input validates to: the raw input, which `invoke`
// parses itself, the parsed input, for `onToolCall`, and when validation
// began, for its duration.
export type CheckedInput = {
  readonly input: unknown
  readonly parsed: unknown
  readonly startedAt: number
}

export type Validate = ToolSchema["~standard"]["validate"]
export type JsonSchema = ToolSchema["~standard"]["jsonSchema"]

/** One request's view of `onToolCall`, bound to the caller's context. */
export type CallReporting = {
  /** Reports a call that began at `startedAt`. Awaited, never thrown. */
  ended: (
    name: string,
    input: unknown,
    startedAt: number,
    outcome: McpToolOutcome
  ) => Promise<void>
  /**
   * A tool's input schema: it checks the input like `toolSchema`, passes the
   * raw input on beside the parsed one, and reports a refusal. The MCP SDK
   * still refuses the call itself; this only watches.
   */
  schema: (
    name: string,
    jsonSchema: JsonSchema,
    validate: Validate
  ) => ToolSchema<CheckedInput>
}

export function createCallReporting<TContext>(
  context: TContext,
  onToolCall:
    | ((call: McpToolCall, context: TContext) => void | Promise<void>)
    | undefined,
  onError: ((error: Error) => void) | undefined
): CallReporting {
  const reportError = (error: unknown) => {
    try {
      onError?.(error instanceof Error ? error : new Error(String(error)))
    } catch {
      // A failing `onError` must not change the tool's answer either.
    }
  }

  // Awaited, never thrown: the client's answer is the same whatever it does.
  const ended: CallReporting["ended"] = async (
    name,
    input,
    startedAt,
    outcome
  ) => {
    if (!onToolCall) {
      return
    }
    try {
      await onToolCall(
        { ...outcome, durationMs: performance.now() - startedAt, input, name },
        context
      )
    } catch (error) {
      reportError(error)
    }
  }

  return {
    ended,
    schema: (name, jsonSchema, validate) => ({
      "~standard": {
        jsonSchema,
        validate: async (input) => {
          const startedAt = performance.now()
          let result: StandardSchemaV1.Result<unknown>
          try {
            result = await validate(input)
          } catch (error) {
            await ended(name, input, startedAt, { error, ok: false })
            throw error
          }
          // Refused only with an issue, as the MCP SDK reads it.
          if (result.issues?.length) {
            await ended(name, input, startedAt, {
              error: new ToolInputError(name, result.issues),
              ok: false,
            })
            return result
          }
          return {
            value: {
              input,
              parsed: (result as StandardSchemaV1.SuccessResult<unknown>).value,
              startedAt,
            },
          }
        },
        vendor: "zeno-lib",
        version: 1,
      },
    }),
  }
}
