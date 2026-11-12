import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  McpServer,
  OAuthError,
  OAuthErrorCode,
} from "@modelcontextprotocol/server"
import {
  type AgentQuery,
  checkAgentTools,
  schemaParts,
  toJsonText,
} from "./agent-tools.ts"
import {
  type CheckedInput,
  createCallReporting,
  type McpToolCall,
} from "./mcp-call.ts"
import {
  type McpWriterContext,
  type McpWrites,
  prepareWrites,
} from "./mcp-writes.ts"

export type { ProposalRefusal } from "./approval-protocol.ts"
// biome-ignore lint/performance/noBarrelFile: the `./mcp` entry re-exports the types and errors its options and hooks use.
export {
  type McpToolCall,
  type McpToolOutcome,
  ToolInputError,
} from "./mcp-call.ts"
export {
  type AgentWrite,
  type McpWriterContext,
  type McpWrites,
  ProposalRefusedError,
  type UsedProposal,
} from "./mcp-writes.ts"

export type McpRouteHandler = (request: Request) => Promise<Response>

export type McpRouteOptions<TContext> = {
  /** The server's name, as MCP clients show it. */
  name: string
  version: string
  /** Server instructions MCP clients may add to the model's context. */
  instructions?: string
  /** The read-only tools to serve: `defineQuery` object-form exports. */
  tools: readonly AgentQuery<TContext>[]
  /**
   * Writes the user approves in an MCP Apps card before anything is written.
   * Each write becomes a tool that only proposes its change, and one app-only
   * `apply_change` tool applies a proposal the user confirmed. Needs a context
   * with `claims.sub`. Leave it out to serve reads only.
   */
  writes?: TContext extends McpWriterContext ? McpWrites<TContext> : never
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
   * Runs once after each `tools/call` of one of `tools`, of a write's propose
   * tool and of `apply_change`, with the caller's context: whether it
   * succeeded, failed, or was refused for invalid input. For an audit log,
   * say: what to record from the call is yours to pick (from a paged read's
   * result, `items.length` and `total`).
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
 * With `writes`, each write is served as a tool that writes nothing: it runs
 * `definition.describe` and returns the change for an MCP Apps card, with a
 * proposal sealed for this user. The card's Confirm calls the app-only
 * `apply_change`, which checks the seal, the expiry and the user, marks the
 * proposal used, refuses a record that changed since (returning the new
 * change), then runs `definition.invoke`. The host hides `apply_change` from
 * the model, but a plain MCP client lists it: every check is the server's.
 *
 * Throws when two tools share a name, a tool in `tools` writes, a write has no
 * `describeChange`, a schema can't describe itself as JSON Schema, or
 * `writes.secret` is shorter than 32 characters.
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
  const writes =
    options.writes &&
    prepareWrites(tools, options.writes as McpWrites<TContext>)
  // Once per route: `schemaParts` checks the schema and keeps its JSON Schema.
  const reads = tools.map(({ definition }) => ({
    definition,
    ...schemaParts(definition),
  }))

  const buildServer = async (context: TContext) => {
    const server = new McpServer(
      { name, version },
      instructions === undefined ? {} : { instructions }
    )
    const reporting = createCallReporting(context, onToolCall, onError)
    const { ended, schema } = reporting
    for (const { definition, jsonSchema, validate } of reads) {
      const toolName = definition.name
      server.registerTool(
        toolName,
        {
          annotations: { openWorldHint: false, readOnlyHint: true },
          description: definition.description,
          inputSchema: schema(toolName, jsonSchema, validate),
        },
        async ({ input, parsed, startedAt }: CheckedInput) => {
          let value: unknown
          let text: string
          try {
            value = await definition.invoke(input, context)
            text = toJsonText(value)
          } catch (error) {
            await ended(toolName, parsed, startedAt, { error, ok: false })
            throw error
          }
          await ended(toolName, parsed, startedAt, { ok: true, result: value })
          return { content: [{ text, type: "text" as const }] }
        }
      )
    }
    if (writes && (await writes.enabled(context))) {
      writes.register(server, context, reporting)
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
