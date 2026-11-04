import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  McpServer,
  OAuthError,
  OAuthErrorCode,
} from "@modelcontextprotocol/server"
import { type AgentQuery, checkAgentTools, toolSchema } from "./agent-tools.ts"

export type McpRouteHandler = (request: Request) => Promise<Response>

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
  /** Reports errors the MCP handler swallows (a factory failure, a rejected request). */
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
 * model reads.
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
    resourceMetadataUrl,
    setup,
    tools,
    version,
  } = options
  checkAgentTools(tools, { readOnly: true })

  const buildServer = async (context: TContext) => {
    const server = new McpServer(
      { name, version },
      instructions === undefined ? {} : { instructions }
    )
    for (const { definition } of tools) {
      server.registerTool(
        definition.name,
        {
          annotations: { openWorldHint: false, readOnlyHint: true },
          description: definition.description,
          inputSchema: toolSchema(definition),
        },
        async (input: unknown) => {
          const value = await definition.invoke(input, context)
          return {
            content: [{ text: JSON.stringify(value), type: "text" as const }],
          }
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
