import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  McpServer,
  OAuthError,
  OAuthErrorCode,
} from "@modelcontextprotocol/server"
import type { StandardSchemaV1 } from "@standard-schema/spec"
import {
  type AgentQuery,
  checkAgentTools,
  type ToolSchema,
  toJsonText,
  toolSchema,
} from "./agent-tools.ts"

export type McpRouteHandler = (request: Request) => Promise<Response>

/** How a tool call ended: what the tool returned, or why it failed. */
export type McpToolOutcome =
  | {
      readonly ok: true
      /** What `definition.invoke` returned, before it became JSON text. */
      readonly result: unknown
    }
  | {
      readonly ok: false
      /**
       * What the tool threw, or a `ToolInputError` when its schema refused
       * the input and it never ran.
       */
      readonly error: unknown
    }

/**
 * One `tools/call` of a served tool, as `onToolCall` receives it: what was
 * asked, how it ended and how long it took.
 */
export type McpToolCall = McpToolOutcome & {
  /** The tool's name: its definition's `name`. */
  readonly name: string
  /**
   * The input as the tool's schema parsed it, defaults filled in (a paged
   * read's `limit` and `offset`). When the schema refused it, the arguments
   * the client sent.
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
      `Invalid arguments for tool ${tool}: ${issues.map(({ message }) => message).join(", ")}`
    )
    this.issues = issues
  }
}

export type McpRouteOptions<TContext> = {
  /** The server's name, as MCP clients show it. */
  name: string
  version: string
  /** Server instructions MCP clients may add to the model's context. */
  instructions?: string
  /**
   * The read-only tools to serve: `defineQuery` object-form exports. How a
   * write shows its change over MCP is not settled yet, so writes are refused.
   */
  tools: readonly AgentQuery<TContext>[]
  /**
   * Resolves the caller from its bearer token: `getBearerContext` from
   * `createRequestDb`. An `UnauthenticatedError` answers 401; anything else it
   * throws (Auth unreachable, say) propagates.
   */
  getContext: (request: Request) => Promise<TContext>
  /**
   * The public URL of this resource's protected resource metadata, for the
   * 401's `WWW-Authenticate` challenge, e.g.
   * `getOAuthProtectedResourceMetadataUrl(new URL(process.env.MCP_URL))`. Take
   * it from config, never from the request: behind a proxy or on `127.0.0.1`,
   * `request.url` names a host clients can't use. A function is resolved per
   * request, so a build without the variable can still import the route.
   */
  resourceMetadataUrl: string | (() => string)
  /**
   * Runs on each request's server after the tools are registered, with the
   * caller's context: register a resource or a tool of your own.
   */
  setup?: (server: McpServer, context: TContext) => void | Promise<void>
  /**
   * Runs once after each `tools/call` of one of `tools`, with the caller's
   * context: whether it succeeded, failed, or was refused for invalid input.
   * For an audit log, say: what to record from the call is yours to pick
   * (from a paged read's result, `items.length` and `total`).
   *
   * The call's answer waits for it, so a record is written before the client
   * sees the result: on a serverless host, work left running after the
   * response may be frozen or dropped. Its time adds to every call's, so keep
   * it to one write and bound that write yourself (a statement timeout).
   * Whatever it throws goes to `onError`, and the client's answer is the same.
   *
   * Not reported: a call naming a tool this route doesn't serve, which the MCP
   * SDK refuses before any of this route's code runs, and calls to the tools
   * `setup` registers, whose handlers are yours to instrument.
   */
  onToolCall?: (call: McpToolCall, context: TContext) => void | Promise<void>
  /**
   * Reports errors the MCP handler swallows (a factory failure, a rejected
   * request), and anything `onToolCall` throws.
   */
  onError?: (error: Error) => void
}

// What a served tool's input validates to: the raw input, which `invoke`
// parses itself, the parsed input, for `onToolCall`, and when validation
// began, for its duration.
type CheckedInput = {
  readonly input: unknown
  readonly parsed: unknown
  readonly startedAt: number
}

// Matched by name, not class: the app's `@zeno-lib/db` may be another copy.
const isUnauthenticated = (error: unknown) =>
  error instanceof Error && error.name === "UnauthenticatedError"

/**
 * Builds the route handlers of a stateless MCP endpoint that serves `tools`
 * as the bearer token's user:
 *
 * ```ts
 * // app/mcp/route.ts
 * export const { GET, POST, DELETE } = createMcpRoute({ … })
 * ```
 *
 * Each request resolves the caller first, so every MCP request needs a token,
 * then gets a fresh `McpServer` with one tool per definition, served by the MCP
 * SDK's `createMcpHandler`. It answers both the 2026-07-28 revision and the
 * 2025-era `initialize` handshake clients fall back to. A tool runs
 * `definition.invoke(input, context)`; its result is the JSON text of what the
 * read returned, and a thrown error becomes a tool error whose message the
 * model reads. `onToolCall` sees each call to these tools, its outcome and its
 * duration.
 *
 * Throws when two tools share a name, a tool writes, or a schema can't
 * describe itself as JSON Schema.
 */
export function createMcpRoute<TContext>(options: McpRouteOptions<TContext>): {
  DELETE: McpRouteHandler
  GET: McpRouteHandler
  POST: McpRouteHandler
} {
  const {
    getContext,
    instructions,
    name,
    onError,
    onToolCall,
    resourceMetadataUrl,
    setup,
    tools,
    version,
  } = options
  checkAgentTools(tools, { readOnly: true })
  // Once per route, not per request: the schemas never change.
  const registrations = tools.map(({ definition }) => ({
    definition,
    schema: toolSchema(definition, (input, parsed) => ({ input, parsed })),
  }))

  const reportError = (error: unknown) => {
    try {
      onError?.(error instanceof Error ? error : new Error(String(error)))
    } catch {
      // A failing `onError` must not change the tool's answer either.
    }
  }

  // Awaited, never thrown: the client's answer is the same whatever it does.
  const report = async (
    call: McpToolCall,
    context: TContext
  ): Promise<void> => {
    if (!onToolCall) {
      return
    }
    try {
      await onToolCall(call, context)
    } catch (error) {
      reportError(error)
    }
  }

  // The route's schema, timed, with a refused input reported. The MCP SDK
  // refuses the call itself; this only watches.
  const reportingSchema = (
    toolName: string,
    { "~standard": standard }: (typeof registrations)[number]["schema"],
    context: TContext
  ): ToolSchema<CheckedInput> => ({
    "~standard": {
      jsonSchema: standard.jsonSchema,
      validate: async (input) => {
        const startedAt = performance.now()
        const result = await standard.validate(input)
        if (result.issues) {
          await report(
            {
              durationMs: performance.now() - startedAt,
              error: new ToolInputError(toolName, result.issues),
              input,
              name: toolName,
              ok: false,
            },
            context
          )
          return result
        }
        return { value: { ...result.value, startedAt } }
      },
      vendor: standard.vendor,
      version: 1,
    },
  })

  const buildServer = async (context: TContext) => {
    const server = new McpServer(
      { name, version },
      instructions === undefined ? {} : { instructions }
    )
    for (const { definition, schema } of registrations) {
      const toolName = definition.name
      server.registerTool(
        toolName,
        {
          annotations: { openWorldHint: false, readOnlyHint: true },
          description: definition.description,
          inputSchema: reportingSchema(toolName, schema, context),
        },
        async ({ input, parsed, startedAt }: CheckedInput) => {
          const ended = (outcome: McpToolOutcome) =>
            report(
              {
                ...outcome,
                durationMs: performance.now() - startedAt,
                input: parsed,
                name: toolName,
              },
              context
            )
          let value: unknown
          let text: string
          try {
            value = await definition.invoke(input, context)
            text = toJsonText(value)
          } catch (error) {
            await ended({ error, ok: false })
            throw error
          }
          await ended({ ok: true, result: value })
          return { content: [{ text, type: "text" as const }] }
        }
      )
    }
    await setup?.(server, context)
    return server
  }

  const handle: McpRouteHandler = async (request) => {
    let context: TContext
    try {
      context = await getContext(request)
    } catch (error) {
      if (!isUnauthenticated(error)) {
        throw error
      }
      return bearerAuthChallengeResponse(
        new OAuthError(OAuthErrorCode.InvalidToken, (error as Error).message),
        {
          resourceMetadataUrl:
            typeof resourceMetadataUrl === "function"
              ? resourceMetadataUrl()
              : resourceMetadataUrl,
        }
      )
    }

    // One handler per request: the server closes over this caller's context,
    // and nothing survives between invocations on a serverless host.
    const handler = createMcpHandler(
      () => buildServer(context),
      onError ? { onerror: onError } : {}
    )
    return handler.fetch(request)
  }

  return { DELETE: handle, GET: handle, POST: handle }
}
