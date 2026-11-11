---
"@zeno-lib/ai": minor
---

`createMcpRoute` takes `onToolCall(call, context)`, called once after each call to one of its tools with the tool's name, the parsed input (the raw arguments when the schema refused them), how it ended (`ok` with the `result`, or the `error`) and its `durationMs`, plus the caller's context. Input the schema refuses is reported with a `ToolInputError`. The answer waits for the hook, and anything it throws goes to `onError` without changing the answer.
