---
"@zeno-lib/ai": minor
---

`toAiSdkTools` refuses an approved write when its record changed after the user approved it. Before the write runs, `describeChange` reads the record again; if a field it lists now starts from a different value, the write is not saved and the model reads the change as it is now, so it can ask again. As with `apply_change` over MCP, only the fields and their old values are compared, so a `describeChange` that computes a new value on each read still runs.

A write now runs only with its approval request in the messages. A route that leaves `toolApproval` out no longer asks for an approval without the change: each write is refused, and the model reads that `toolApproval` is missing. Writes no longer carry the tool-level `needsApproval`.
