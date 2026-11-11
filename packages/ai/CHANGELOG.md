# @zeno-lib/ai

## 0.2.0

### Minor Changes

- bf05bb6: `createMcpRoute` takes `onToolCall(call, context)`, called once after each call to one of its tools with the tool's name, the parsed input (the raw arguments when the schema refused them), how it ended (`ok` with the `result`, or the `error`) and its `durationMs`, plus the caller's context. Input the schema refuses is reported with a `ToolInputError`. The answer waits for the hook, and anything it throws goes to `onError` without changing the answer.

### Patch Changes

- Updated dependencies [dace792]
  - @zeno-lib/db@0.20.0

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
