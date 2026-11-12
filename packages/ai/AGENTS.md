# `@zeno-lib/ai`

Turns `@zeno-lib/db`'s object-form definitions into AI SDK tools and an MCP endpoint. The user guide
is in [`ai`](../../apps/docs/content/docs/core-framework/ai/index.mdx).

## Rules

- **Never hand a library the definition's schema itself; use `toolSchema`.** AI SDK and the MCP SDK
  both validate a tool's input and pass the **parsed output** on, and the tool is `invoke` or
  `describe`, which parse again. A schema whose output is not valid input (a `transform` from string
  to number) then fails. `toolSchema` validates and passes the raw input on. `createMcpRoute` keeps
  the parsed input too, for `onToolCall`: `invoke` still takes the raw one, never `parsed`. Its
  vendor must not be `zod`: AI SDK parses a Zod schema on its own path and would return the output.
  `src/tools.test.ts` and `src/mcp.test.ts` cover it with such a schema.
- **A write is never put to the user without its change.** `checkAgentTools` refuses a write with no
  `describeChange`, and a `describe` that throws or returns `null` denies the call. Don't fall back to
  an approval that only names the tool.
- **Keep the tool-level `needsApproval` on writes**, deprecated as it is. AI SDK reads it only when
  `toolApproval` has no entry for the tool, so a route that forgets `toolApproval` asks before a
  write instead of running it.
- **Over MCP, a write's own tool only proposes; only `apply_change` writes.** An MCP client's prompt
  names the tool, not the change, so the change is shown in the approval card instead. Never let a
  propose tool write, and keep every check in `apply_change` (seal, expiry, user, replay, stale):
  only the host hides an app-only tool, and a plain MCP client lists and calls it.
- **A proposal seals the raw input**, never the parsed one: `describe` and `invoke` parse it
  again, and a parsed value may be neither valid input nor JSON.
- **`markUsed` runs before the record is read again.** After an applied write the record has moved,
  so a replay checked later would come back stale, with a fresh proposal it could confirm again.
- **The card sets text, never HTML**, through `formatValue` and `singleLine`: the entity and the
  values come from the database, as in `formatChange`.
- **`formatChange` escapes every character that can break or reorder a line** (C0 and C1 controls,
  U+2028, U+2029, the bidi marks), in values and names alike. `JSON.stringify` leaves some raw, and
  database text reaches the approval.
- **Import only types from `@zeno-lib/db`.** `/next` imports `react`, and a second copy of the
  package breaks `instanceof`, so `UnauthenticatedError` is matched by `name`.
- **Keep every peer in tsdown's `deps.neverBundle`.** A bundled MCP SDK would build a different
  `McpServer` class from the one the app's `setup` receives.
- **`@modelcontextprotocol/ext-apps` is a dev dependency, bundled, never a peer**, and the only entry
  in `deps.onlyBundle`. The host's CSP lets the card load no script, so `inline-script.ts` (a
  Rolldown plugin both tsdown and Vitest run) bundles `src/approval-card/card.ts` into its HTML.
  `card.ts` runs in the browser: it imports only `ext-apps`, `approval-protocol.ts` and
  `agent-tools.ts`, never a file that reaches Node or the MCP server SDK.
- **The 401's metadata URL comes from config, never `request.url`**, which names the host the
  request reached (`localhost`, a proxy), not the one clients use.
