---
"@zeno-lib/forms": patch
---

Required-field detection no longer marks a string field whose schema accepts
`""`, the value the form starts it at. A bare `z.string()` or
`z.string().nullable()` can't fail while untouched, so it gets no `*`;
`z.string().min(1)` and `z.email()` keep theirs.
