---
"@zeno-lib/schema": patch
---

A function refinement on a nullable or defaulted column now keeps that field
optional in the `insert` type. Drizzle typed it as required, while the parsed
value could still omit it, so `defineTableSchema(t, { insert: { note: (s) =>
s.min(1) } })` rejected payloads at compile time that it accepted at runtime.
