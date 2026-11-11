# `@zeno-lib/ai`

Turns `@zeno-lib/db`'s object-form definitions into AI SDK tools and an MCP endpoint. The user guide
is in [`ai`](../../apps/docs/content/docs/core-framework/ai/index.mdx).

## Rules

- **Never hand a library the definition's schema itself; use `toolSchema`.** AI SDK and the MCP SDK
  both validate a tool's input and pass the **parsed output** on, and the tool is `invoke` or
  `describe`, which parse again. A schema whose output is not valid input (a `transform` from string
  to number) then fails. `toolSchema` validates and passes the raw input on; `createMcpRoute` gets
  it as `input`, beside the `parsed` one `onToolCall` reports, and hands `invoke` the `input`. Its
  vendor must not be `zod`: AI SDK parses a Zod schema on its own path and would return the output.
  `src/tools.test.ts` and `src/mcp.test.ts` cover it with such a schema.
- **A write is never put to the user without its change.** `checkAgentTools` refuses a write with no
  `describeChange`, and a `describe` that throws or returns `null` denies the call. Don't fall back to
  an approval that only names the tool.
- **Keep the tool-level `needsApproval` on writes**, deprecated as it is. AI SDK reads it only when
  `toolApproval` has no entry for the tool, so a route that forgets `toolApproval` asks before a
  write instead of running it.
- **`createMcpRoute` serves reads only.** How an MCP client shows a write's change before it runs is
  not settled (Claude's prompt names the tool, not its arguments, and claude.ai has no
  elicitation). Don't widen `tools` until that is designed; `setup` is the opening for it.
- **`formatChange` escapes every character that can break or reorder a line** (C0 and C1 controls,
  U+2028, U+2029, the bidi marks), in values and names alike. `JSON.stringify` leaves some raw, and
  database text reaches the approval.
- **Import only types from `@zeno-lib/db`.** `/next` imports `react`, and a second copy of the
  package breaks `instanceof`, so `UnauthenticatedError` is matched by `name`.
- **Keep every peer in tsdown's `deps.neverBundle`.** A bundled MCP SDK would build a different
  `McpServer` class from the one the app's `setup` receives.
- **The 401's metadata URL comes from config, never `request.url`**, which names the host the
  request reached (`localhost`, a proxy), not the one clients use.
