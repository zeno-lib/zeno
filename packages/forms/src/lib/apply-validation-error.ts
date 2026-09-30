import type { AnyFormApi } from "@tanstack/react-form"

import type { ValidationError } from "./validation-error"

// Clear a server message the first time the field's value moves off the value
// it was rejected with. TanStack Form does not do this on its own: a field
// with no validators of its own runs nothing on change, and the form-level
// pass keeps an error it did not write, so the message would otherwise stick,
// and keep `canSubmit` false, until the form is reset. Only that field is
// cleared, and only while the entry is still ours: a schema error written over
// it in the meantime is left alone.
function clearWhenEdited(
  formApi: AnyFormApi,
  name: string,
  entry: unknown
): void {
  const rejected = formApi.getFieldValue(name)
  const subscription = formApi.store.subscribe(() => {
    if (formApi.getFieldMeta(name)?.errorMap?.onChange !== entry) {
      subscription.unsubscribe()
      return
    }
    if (Object.is(formApi.getFieldValue(name), rejected)) {
      return
    }
    subscription.unsubscribe()
    formApi.setFieldMeta(name, (prev) => ({
      ...prev,
      errorMap: { ...prev.errorMap, onChange: undefined },
    }))
  })
}

// Write per-field messages from a `ValidationError` onto the form. They go in
// `errorMap.onChange` (an array when there are several, which TanStack
// flattens into `meta.errors`) and clear as soon as the user edits that
// field; see `clearWhenEdited`. The form-level message is written to the
// form's error map under the `onSubmit` cause, which TanStack clears on the
// next change that validates cleanly.
function applyValidationError(
  formApi: AnyFormApi,
  error: ValidationError
): void {
  for (const [name, message] of Object.entries(error.fields)) {
    const messages = Array.isArray(message) ? message : [message]
    const errors = messages.map((m) => ({ message: m }))
    const entry = errors.length === 1 ? errors[0] : errors
    formApi.setFieldMeta(name, (prev) => ({
      ...prev,
      errorMap: { ...prev.errorMap, onChange: entry },
      errors,
      isValid: false,
    }))
    clearWhenEdited(formApi, name, entry)
  }
  if (error.formError) {
    formApi.setErrorMap({
      onSubmit: { fields: {}, form: error.formError },
    })
  }
}

export { applyValidationError }
