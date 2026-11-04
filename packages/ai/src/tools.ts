import { type Tool, type ToolApprovalStatus, tool } from "ai"
import {
  type AgentTool,
  checkAgentTools,
  formatChange,
  toolSchema,
} from "./agent-tools.ts"

/** Asks for the user's approval of one write, with the change as its reason. */
export type ToolApprovalFunction = (
  input: unknown
) => Promise<ToolApprovalStatus>

export type AiSdkTools = {
  /** One AI SDK tool per definition, keyed by its name. */
  // biome-ignore lint/suspicious/noExplicitAny: AI SDK's own `ToolSet` is keyed to `Tool<any, any>`.
  tools: Record<string, Tool<any, unknown>>
  /**
   * `streamText`'s `toolApproval`: one entry per write. Merge your own tools'
   * entries into it rather than replacing it.
   */
  toolApproval: Record<string, ToolApprovalFunction>
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

/**
 * Turns a tool list into AI SDK tools that run as `context`'s caller, plus the
 * `toolApproval` for `streamText`. Build both per request, from the request's
 * context (`withVia(await getRequestContext(), "AI assistant")`).
 *
 * - A tool runs `definition.invoke(input, context)`. A form action's
 *   `{ ok: false }` comes back as the tool's output; a thrown error becomes AI
 *   SDK's tool error, whose message the model reads.
 * - Every write waits for the user: its approval's reason is the change from
 *   `definition.describe`, formatted by `formatChange`. When `describe` throws
 *   (the record is not visible to the caller, say), the call is denied with
 *   the error as its reason, never put to the user without the change.
 *
 * Throws when two tools share a name, a write has no `describeChange`, or a
 * schema can't describe itself as JSON Schema.
 */
export function toAiSdkTools<TContext>(
  agentTools: readonly AgentTool<TContext>[],
  context: TContext
): AiSdkTools {
  checkAgentTools(agentTools)

  const tools: AiSdkTools["tools"] = {}
  const toolApproval: AiSdkTools["toolApproval"] = {}

  for (const { definition } of agentTools) {
    tools[definition.name] = tool({
      description: definition.description,
      execute: (input: unknown) => definition.invoke(input, context),
      inputSchema: toolSchema(definition),
    })

    if (!definition.readOnly) {
      toolApproval[definition.name] = async (input) => {
        try {
          const change = await definition.describe(input, context)
          if (!change) {
            return { reason: "This change can't be described", type: "denied" }
          }
          return { reason: formatChange(change), type: "user-approval" }
        } catch (error) {
          return {
            reason: `Could not read what this change would do: ${errorMessage(error)}`,
            type: "denied",
          }
        }
      }
    }
  }

  return { toolApproval, tools }
}
