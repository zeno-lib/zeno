# @zeno-lib/ai

## 0.1.0

### Minor Changes

- 4f931ad: New package: `@zeno-lib/ai` serves the object-form definitions of `@zeno-lib/db/next` to an AI agent, as the signed-in user.
  
  - `toAiSdkTools(tools, context)` from `@zeno-lib/ai/tools` returns AI SDK tools that run `definition.invoke(input, context)`, plus the `toolApproval` for `streamText`: every write waits for the user, with the change from `definition.describe` as the approval's reason. A `describe` that fails denies the call.
  - `createMcpRoute({ name, version, tools, getContext, resourceMetadataUrl })` from `@zeno-lib/ai/mcp` returns the `GET`, `POST` and `DELETE` handlers of a stateless MCP endpoint on the MCP SDK's `createMcpHandler`, for the 2026-07-28 revision and the 2025 `initialize` fallback. It serves reads only for now, answers a missing or invalid token with a 401 whose `WWW-Authenticate` points at your protected resource metadata, and takes `setup(server, context)` to add your own resources or tools.
  - `formatChange(change)` from `@zeno-lib/ai` turns a `ChangeDescription` into the approval text, with values quoted so stored text can't fake a line.
  - A tool list is checked when it is built: one tool per name, a `describeChange` on every write, and a schema that implements Standard JSON Schema (Zod 4.2 or later). The libraries validate the input but pass it on raw, so a definition parses it once.

### Patch Changes

- Updated dependencies [4f931ad]
  - @zeno-lib/db@0.16.0
