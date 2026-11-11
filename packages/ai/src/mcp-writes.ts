import {
  RESOURCE_MIME_TYPE,
  registerAppResource,
  registerAppTool,
} from "@modelcontextprotocol/ext-apps/server"
import type { CallToolResult, McpServer } from "@modelcontextprotocol/server"
import type { ChangeDescription } from "@zeno-lib/db/next"
import {
  type AgentQuery,
  type AgentTool,
  type AgentWriteDefinition,
  checkAgentTools,
  formatChange,
  schemaParts,
} from "./agent-tools.ts"
import { cardHtml } from "./approval-card/html.ts"
import {
  APPLY_TOOL,
  type ApprovalContent,
  CARD_URI,
  PROPOSAL_META_KEY,
  type ProposalRefusal,
} from "./approval-protocol.ts"
import type {
  CallReporting,
  CheckedInput,
  JsonSchema,
  McpToolOutcome,
  Validate,
} from "./mcp-call.ts"
import {
  createProposalSeal,
  fromValues,
  MIN_SECRET_LENGTH,
  type Proposal,
  startsFrom,
} from "./proposal.ts"

/** A write agent tool: a `defineAction` or `defineFormAction` object-form export with a `describeChange`. */
export type AgentWrite<TContext> = AgentTool<
  TContext,
  AgentWriteDefinition<TContext>
>

/** A context that names its user, as `getBearerContext`'s does. */
export type McpWriterContext = {
  readonly claims: { readonly sub: string }
}

/** A proposal `markUsed` records. */
export type UsedProposal = {
  /** Unique per proposal. */
  readonly id: string
  /** The write's name. */
  readonly tool: string
  /** The user who confirmed it: `claims.sub`. */
  readonly user: string
  /** When it would have expired: a record of it can be dropped after this. */
  readonly expiresAt: Date
}

/** `createMcpRoute`'s `writes`: writes the user confirms in a card first. */
export type McpWrites<TContext> = {
  /**
   * The writes to serve: `defineAction` or `defineFormAction` object-form
   * exports, each with a `describeChange`. Each becomes a tool that only
   * proposes its change; the user's Confirm in the card applies it.
   */
  tools: readonly AgentWrite<TContext>[]
  /**
   * The server secret that signs proposals, at least 32 characters, from
   * config (`openssl rand -base64 32`). A list rotates it: the first signs,
   * any of them verifies, so drop the old one once its proposals expired.
   */
  secret: string | readonly string[]
  /**
   * Records a proposal as used, so a second Confirm (a replay) is refused.
   * Resolve `true` when this call recorded it, `false` when it was already
   * there: an `insert … on conflict do nothing returning id` on a unique id,
   * say. It must be atomic: two concurrent Confirms must not both get `true`.
   *
   * It runs once the seal, the expiry and the user check out, before the
   * record is read again. So a proposal that turns out stale is used too (the
   * card confirms the new change with a fresh one), and one whose write fails
   * needs the change asked for again.
   */
  markUsed: (
    proposal: UsedProposal,
    context: TContext
  ) => boolean | Promise<boolean>
  /** How long a proposal stays confirmable, in seconds. Defaults to 600. */
  ttlSeconds?: number
  /**
   * Whether this caller gets the writes, per request: return `true` only for
   * clients you know render MCP Apps cards and hide app-only tools from the
   * model (from `context.via`, say). Without it, every caller gets them.
   */
  enabled?: (context: TContext) => boolean | Promise<boolean>
}

/**
 * What `onToolCall` reports when `apply_change` refuses a proposal: nothing
 * was written.
 */
export class ProposalRefusedError extends Error {
  override readonly name = "ProposalRefusedError"
  /** Why it was refused. */
  readonly reason: ProposalRefusal

  constructor(reason: ProposalRefusal, message: string) {
    super(message)
    this.reason = reason
  }
}

const DEFAULT_TTL_SECONDS = 600

const PROPOSE_NOTE =
  "Calling this tool saves nothing: it shows the user the change in a card, and only their Confirm saves it."

// `apply_change` takes the sealed proposal, as the card received it.
const APPLY_JSON_SCHEMA = {
  additionalProperties: false,
  properties: {
    proposal: {
      description: "The sealed proposal, from the propose tool's result.",
      type: "string",
    },
  },
  required: ["proposal"],
  type: "object",
}
const applyJsonSchema: JsonSchema = {
  input: () => APPLY_JSON_SCHEMA,
  output: () => APPLY_JSON_SCHEMA,
}
const validateApply: Validate = (value) =>
  typeof (value as { proposal?: unknown } | null)?.proposal === "string"
    ? { value }
    : { issues: [{ message: "Expected a string", path: ["proposal"] }] }

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

// A form write's refusal: `{ ok: false, error: { formErrors, fieldErrors } }`.
const formRefusal = (value: unknown): string | null => {
  const result = value as {
    ok?: unknown
    error?: {
      fieldErrors?: Record<string, readonly string[]>
      formErrors?: readonly string[]
    }
  } | null
  if (result?.ok !== false) {
    return null
  }
  const messages = [
    ...(result.error?.formErrors ?? []),
    ...Object.entries(result.error?.fieldErrors ?? {}).map(
      ([field, errors]) => `${field}: ${errors.join(", ")}`
    ),
  ]
  return messages.join("; ") || "The change was refused"
}

const userOf = (context: unknown): string => {
  const sub = (context as Partial<McpWriterContext> | null)?.claims?.sub
  if (typeof sub !== "string" || sub === "") {
    throw new TypeError(
      "A write needs a context whose claims.sub names the user, as getBearerContext's does"
    )
  }
  return sub
}

// The card's data, and the text a plain client (or the model) reads.
const answer = (
  content: ApprovalContent,
  text: string,
  meta?: CallToolResult["_meta"]
): CallToolResult => ({
  content: [{ text, type: "text" }],
  structuredContent: content,
  ...(content.status === "proposed" || content.status === "applied"
    ? {}
    : { isError: true }),
  ...(meta ? { _meta: meta } : {}),
})

// What `apply_change` answers, and what it reports to `onToolCall`.
type Answer = {
  readonly outcome: McpToolOutcome
  readonly result: CallToolResult
}

const refused = (
  reason: Exclude<ProposalRefusal, "stale">,
  message: string
): Answer => ({
  outcome: { error: new ProposalRefusedError(reason, message), ok: false },
  result: answer({ message, status: reason }, message),
})

const failed = (error: unknown): Answer => {
  const message = `The change could not be saved: ${errorMessage(error)}`
  return {
    outcome: { error, ok: false },
    result: answer({ message, status: "failed" }, message),
  }
}

// Runs a step whose throw ends the apply as `failed`.
const attempt = async <T>(
  step: () => T | Promise<T>
): Promise<{ value: T } | { answer: Answer }> => {
  try {
    return { value: await step() }
  } catch (error) {
    return { answer: failed(error) }
  }
}

/** The writes of a route, checked once, registered per request. */
export type RouteWrites<TContext> = {
  enabled: (context: TContext) => Promise<boolean>
  register: (
    server: McpServer,
    context: TContext,
    reporting: CallReporting
  ) => void
}

/**
 * Checks `writes` when the route is built: one tool per name across reads and
 * writes, a `describeChange` on every write, none named `apply_change`, and a
 * long enough secret.
 */
export function prepareWrites<TContext>(
  reads: readonly AgentQuery<TContext>[],
  writes: McpWrites<TContext>
): RouteWrites<TContext> {
  for (const { definition } of writes.tools) {
    if (definition?.readOnly) {
      throw new TypeError(`"${definition.name}" reads: serve it in tools`)
    }
  }
  const all = [...reads, ...writes.tools]
  checkAgentTools<TContext>(all)
  if (all.some(({ definition }) => definition.name === APPLY_TOOL)) {
    throw new TypeError(
      `"${APPLY_TOOL}" is the name of the tool that applies a write`
    )
  }
  const secrets =
    typeof writes.secret === "string" ? [writes.secret] : [...writes.secret]
  if (
    secrets.length === 0 ||
    secrets.some((secret) => secret.length < MIN_SECRET_LENGTH)
  ) {
    throw new TypeError(
      `writes.secret must be at least ${MIN_SECRET_LENGTH} characters`
    )
  }
  const ttlSeconds = writes.ttlSeconds ?? DEFAULT_TTL_SECONDS
  if (!(Number.isFinite(ttlSeconds) && ttlSeconds > 0)) {
    throw new TypeError("writes.ttlSeconds must be a positive number")
  }
  const ttlMs = ttlSeconds * 1000
  const seal = createProposalSeal(secrets)
  // Once per route: `schemaParts` checks the schema and keeps its JSON Schema.
  const definitions = new Map(
    writes.tools.map(({ definition }) => [
      definition.name,
      { definition, ...schemaParts(definition) },
    ])
  )

  // A proposal for `change`, sealed for this user: its id, and the `_meta`
  // that carries it to the card.
  const propose = async (
    tool: string,
    input: unknown,
    change: ChangeDescription,
    user: string
  ) => {
    const proposal: Proposal = {
      expiresAt: Date.now() + ttlMs,
      from: fromValues(change),
      id: crypto.randomUUID(),
      input,
      tool,
      user,
    }
    return {
      id: proposal.id,
      meta: { [PROPOSAL_META_KEY]: await seal.seal(proposal) },
    }
  }

  type Opened = {
    readonly definition: AgentWriteDefinition<TContext>
    readonly proposal: Proposal
    readonly user: string
  }

  // The seal, the tool, the expiry, the user, then the replay guard: what a
  // proposal must pass before the record is read again. Marked before that
  // read, so a replay is "used", never "stale" with a fresh proposal it could
  // confirm a second time.
  const open = async (
    proposal: Proposal,
    context: TContext
  ): Promise<Opened | Answer> => {
    const definition = definitions.get(proposal.tool)?.definition
    if (!definition) {
      return refused("invalid", "This proposal was not made by this server.")
    }
    if (Date.now() >= proposal.expiresAt) {
      return refused(
        "expired",
        "This proposal expired. Ask for the change again."
      )
    }
    const user = await attempt(() => userOf(context))
    if ("answer" in user) {
      return user.answer
    }
    if (proposal.user !== user.value) {
      return refused("wrong-user", "This proposal was made for another user.")
    }
    const first = await attempt(() =>
      writes.markUsed(
        {
          expiresAt: new Date(proposal.expiresAt),
          id: proposal.id,
          tool: proposal.tool,
          user: user.value,
        },
        context
      )
    )
    if ("answer" in first) {
      return first.answer
    }
    if (!first.value) {
      return refused("used", "This change was already confirmed.")
    }
    return { definition, proposal, user: user.value }
  }

  // Reads the record again, refuses a change that no longer starts where the
  // proposal did (with a fresh proposal for the new one), then writes.
  const apply = async (
    { definition, proposal, user }: Opened,
    context: TContext
  ): Promise<Answer> => {
    const described = await attempt(async () => {
      const change = await definition.describe(proposal.input, context)
      if (!change) {
        throw new Error("This change can't be described")
      }
      return change
    })
    if ("answer" in described) {
      return described.answer
    }
    const change = described.value
    if (!startsFrom(proposal.from, change)) {
      const message =
        "The record changed since this change was proposed. Nothing was saved."
      const fresh = await propose(definition.name, proposal.input, change, user)
      return {
        outcome: {
          error: new ProposalRefusedError("stale", message),
          ok: false,
        },
        result: answer(
          { change, status: "stale" },
          `${message}\nConfirming now would make this change:\n${formatChange(change)}`,
          fresh.meta
        ),
      }
    }
    const written = await attempt(() =>
      definition.invoke(proposal.input, context)
    )
    if ("answer" in written) {
      return written.answer
    }
    const refusal = formRefusal(written.value)
    return {
      outcome: { ok: true, result: written.value },
      result: refusal
        ? answer(
            { message: refusal, status: "failed" },
            `The change was not saved: ${refusal}`
          )
        : answer(
            { change, status: "applied" },
            `Saved:\n${formatChange(change)}`
          ),
    }
  }

  const registerPropose = (
    server: McpServer,
    context: TContext,
    { ended, schema }: CallReporting,
    {
      definition,
      jsonSchema,
      validate,
    }: ReturnType<typeof schemaParts> & {
      definition: AgentWriteDefinition<TContext>
    }
  ) => {
    const toolName = definition.name
    registerAppTool(
      server,
      toolName,
      {
        // It writes nothing: the write runs only from `apply_change`.
        _meta: { ui: { resourceUri: CARD_URI } },
        annotations: { openWorldHint: false, readOnlyHint: true },
        description: `${definition.description}\n\n${PROPOSE_NOTE}`,
        inputSchema: schema(toolName, jsonSchema, validate),
      },
      async ({ input, parsed, startedAt }: CheckedInput) => {
        let change: ChangeDescription | null
        let proposal: Awaited<ReturnType<typeof propose>>
        try {
          change = await definition.describe(input, context)
          if (!change) {
            throw new Error("This change can't be described")
          }
          proposal = await propose(toolName, input, change, userOf(context))
        } catch (error) {
          await ended(toolName, parsed, startedAt, { error, ok: false })
          throw error
        }
        await ended(toolName, parsed, startedAt, {
          ok: true,
          result: { change, proposalId: proposal.id },
        })
        return answer(
          { change, status: "proposed" },
          `Proposed, not saved:\n${formatChange(change)}\n\nThe user sees this change in a card with Confirm and Cancel. Nothing is saved until they confirm it there.`,
          proposal.meta
        )
      }
    )
  }

  const registerApply = (
    server: McpServer,
    context: TContext,
    { ended, schema }: CallReporting
  ) => {
    registerAppTool(
      server,
      APPLY_TOOL,
      {
        _meta: { ui: { resourceUri: CARD_URI, visibility: ["app"] } },
        annotations: { destructiveHint: true, openWorldHint: false },
        description:
          "Applies a change the user confirmed in its approval card. Only the card calls it.",
        inputSchema: schema(APPLY_TOOL, applyJsonSchema, validateApply),
      },
      async ({ input, startedAt }: CheckedInput) => {
        const proposal = await seal.open(
          (input as { proposal: string }).proposal
        )
        const opened = proposal
          ? await open(proposal, context)
          : refused("invalid", "This proposal was not made by this server.")
        const done = "outcome" in opened ? opened : await apply(opened, context)
        await ended(
          APPLY_TOOL,
          proposal && definitions.has(proposal.tool)
            ? {
                input: proposal.input,
                proposalId: proposal.id,
                tool: proposal.tool,
              }
            : input,
          startedAt,
          done.outcome
        )
        return done.result
      }
    )
  }

  return {
    enabled: async (context) => (await writes.enabled?.(context)) ?? true,
    register: (server, context, reporting) => {
      for (const write of definitions.values()) {
        registerPropose(server, context, reporting, write)
      }
      registerApply(server, context, reporting)
      registerAppResource(
        server,
        "Change approval",
        CARD_URI,
        {
          _meta: { ui: { prefersBorder: true } },
          description:
            "Shows a proposed change, old to new, with Confirm and Cancel.",
        },
        () => ({
          contents: [
            {
              _meta: { ui: { prefersBorder: true } },
              mimeType: RESOURCE_MIME_TYPE,
              text: cardHtml,
              uri: CARD_URI,
            },
          ],
        })
      )
    },
  }
}
