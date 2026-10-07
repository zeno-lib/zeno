---
"@zeno-lib/db": patch
---

The RLS clients install the claims and the role in one statement. The role now
goes through `set_config('role', …, true)`, the transaction-local equivalent of
`set local role`, so every awaited statement makes one round trip fewer, and the
clamped role is a bound parameter instead of raw SQL.
