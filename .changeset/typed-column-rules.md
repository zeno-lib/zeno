---
"@zeno-lib/db": minor
---

`withRule(builder, refinement)` takes a function only, and types its parameter from the column: `withRule(numeric({ mode: "number" }), (schema) => schema.min(0))` receives a `z.ZodNumber` with no annotation, and an annotation that doesn't match the column is a type error. A Zod schema as the rule is a type error, because it would replace the `.nullable()` and `.optional()` a nullable column gets. A ruled column refuses `.array()`, in its type and at runtime: call `.array()` before `withRule`. Zod is a new optional peer dependency of `@zeno-lib/db`, imported for types only.
