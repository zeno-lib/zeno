"use client"

import { type AnyFormApi, evaluate } from "@tanstack/react-form"
import { useCallback, useRef } from "react"

// TanStack's `useForm` calls `formApi.update(options)` after every render. While
// the form is untouched, `update` re-applies `options.defaultValues` whenever it
// deep-differs from the form's live defaults. `formApi.reset(values)` rebases
// those live defaults, so a caller that keeps passing the same `defaultValues`
// literal would see the reset undone on the next render (the classic "reset to
// the saved record after submit" flow).
//
// This hook forwards the caller's defaults only when *they* change (deep
// compare, the same `evaluate` TanStack's `update` uses). Otherwise it forwards
// the form's live defaults back, so `update` sees no change and a reset sticks.
// The live FormApi instance comes from the form-level `listeners.onMount`
// callback: the object `useForm` returns is a spread snapshot whose `options`
// never updates.
function useRebasedDefaultValues<T>(callerDefaults: T): {
  defaultValues: T
  onMount: (props: { formApi: AnyFormApi }) => void
} {
  const liveForm = useRef<AnyFormApi | null>(null)
  const lastCallerDefaults = useRef(callerDefaults)

  let defaultValues = callerDefaults
  if (evaluate(lastCallerDefaults.current, callerDefaults)) {
    if (liveForm.current) {
      defaultValues = liveForm.current.options.defaultValues as T
    }
  } else {
    lastCallerDefaults.current = callerDefaults
  }

  const onMount = useCallback((props: { formApi: AnyFormApi }) => {
    liveForm.current = props.formApi
  }, [])

  return { defaultValues, onMount }
}

export { useRebasedDefaultValues }
