"use client"

import { type AnyFormApi, useSelector } from "@tanstack/react-form"
import { useEffect } from "react"

type UnsavedChangesMode = "if-changed" | "if-touched"

// Warn the user before they leave the page with unsaved changes.
//
// Two trigger modes, selected by the caller:
//   - "if-changed" (default) — fires while current values differ from
//     defaults (`!state.isDefaultValue`). Clears when the user restores
//     the originals, or after `formApi.reset(value)` rebases defaults.
//   - "if-touched" — fires after the user has edited any field, even if
//     they reverted (`state.isDirty`, sticky once edited until reset).
//
// `isSubmitting` is always read so the listener detaches during the
// submit round-trip — a successful submit transitions through
// `isSubmitting=true` before the parent typically resets/navigates, and
// we don't want a stale warning to fire in that window.
//
// Modern browsers ignore custom strings on `beforeunload` and show their
// own generic prompt; we still set `returnValue` because some older
// browsers and embedded webviews honour it.
function useUnsavedChangesWarning(
  form: AnyFormApi,
  enabled: boolean | UnsavedChangesMode
): void {
  let mode: UnsavedChangesMode | null
  if (enabled === false) {
    mode = null
  } else if (enabled === true) {
    mode = "if-changed"
  } else {
    mode = enabled
  }
  const dirty = useSelector(form.store, (state) =>
    mode === "if-touched" ? state.isDirty : !state.isDefaultValue
  )
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)
  const active = mode !== null && dirty && !isSubmitting

  useEffect(() => {
    if (!active) {
      return
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [active])
}

export type { UnsavedChangesMode }
export { useUnsavedChangesWarning }
