---
"@zeno-lib/db": minor
---

`withRule(builder, refinement)` types a function refinement's parameter from the column: `withRule(numeric({ mode: "number" }), (schema) => schema.min(0))` receives a `z.ZodNumber` with no annotation, and an annotation that doesn't match the column is a type error. Zod is a new optional peer dependency of `@zeno-lib/db`, imported for types only.
