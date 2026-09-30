---
"@zeno-lib/forms": minor
---

Add `submitAction(submit, action, { schema?, reset? })` and `applyActionError(formApi, error)` for server actions that return an `ActionResult`, such as `defineFormAction` from `@zeno-lib/db/next` (matched structurally, no dependency). Field errors land on their fields, array paths included; unknown paths and `formErrors` become the form-level error. `schema` parses the input values on the client and passes the output to the action; `reset` rebases the form after a success. Fix `ValidationError`/`applyValidationError`: a server message now clears when its field is edited (it previously stuck until reset), and every message for a field renders, not just the first.
