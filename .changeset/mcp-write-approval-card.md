---
"@zeno-lib/ai": minor
---

`createMcpRoute` takes `writes: { tools, secret, markUsed, ttlSeconds?, enabled? }` to serve writes the user approves in an MCP Apps card before anything is written. Each write becomes a read-only tool that runs `describe` and returns the change for the card, with a proposal signed with `secret` (HMAC-SHA-256) for the caller's `claims.sub`. The card's Confirm calls one app-only `apply_change` tool, which checks the signature, the expiry and the user, marks the proposal used through `markUsed`, refuses a record that changed since (returning the new change, which the user can confirm instead), then runs `invoke`. `enabled(context)` serves the writes only to clients you know render cards. `onToolCall` reports the propose and apply calls, and a refused proposal as a `ProposalRefusedError` with its `reason`. A route without `writes` is unchanged.
