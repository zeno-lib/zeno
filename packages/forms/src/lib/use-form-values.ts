"use client"

import { useSelector } from "@tanstack/react-form"

// Structural, like `form-dialog`'s form type: the object `useForm` returns is
// not assignable to TanStack's `AnyFormApi`, and this keeps the values typed.
type FormWithValues<TValues> = {
  store: {
    get: () => { values: TValues }
    subscribe: (listener: (state: { values: TValues }) => void) => {
      unsubscribe: () => void
    }
  }
}

// The form's current values. It re-renders when a value changes, not on
// focus, blur or validation, which is what `useSelector(form.store)` without a
// selector would do.
function useFormValues<TValues>(form: FormWithValues<TValues>): TValues {
  return useSelector(form.store, (state) => state.values)
}

export { useFormValues }
