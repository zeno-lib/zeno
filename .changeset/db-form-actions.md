---
"@zeno-lib/db": minor
---

Add `defineFormAction` to `createRequestDb` in `@zeno-lib/db/next`: a server action that resolves to `ActionResult` (`{ ok: true, data }` or `{ ok: false, error: { fieldErrors, formErrors } }`) instead of throwing on invalid input, so field errors survive Next.js's production redaction of thrown messages. Field keys are TanStack Form names (`owners[0].percentage`). A `FieldValidationError` thrown by the handler is returned in the same shape; other errors still throw. `defineAction` is unchanged. Also exports `toActionError` and `toFieldName`.
