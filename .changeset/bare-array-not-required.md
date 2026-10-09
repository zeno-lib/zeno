---
"@zeno-lib/forms": patch
---

Required-field detection no longer marks a bare `z.array()`, or the rows of a
bare `z.array(z.string())`. The form starts an array at `[]` and a string at
`""`, and both pass, so neither can fail while untouched. `.min(1)` arrays,
rows that reject `""` (`z.array(z.email())`) and required row fields
(`members[0].name`) keep their `*`.
