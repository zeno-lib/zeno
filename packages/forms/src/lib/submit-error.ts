"use client"

import { useSelector } from "@tanstack/react-form"
import { useCallback, useSyncExternalStore } from "react"

// A submit whose handler threw (a network failure, an unexpected server
// error), kept per form so `FormError` can show it.
//
// Not written to TanStack's `errorMap`: any entry there makes the form
// invalid, which disables `SubmitButton`, and `handleSubmit` then skips
// `onSubmit` until an edit clears the entry. The user couldn't retry a failed
// save as is.

type SubmitErrorState = {
  readonly submissionAttempts: number
  readonly values: unknown
}

// The slice of a form the helpers read. Keyed by `store`, as the per-form
// Zeno state is (`validation-modes.ts`): it is the one reference shared by
// the `useForm()` result and the form API that fields and context receive.
type SubmitErrorForm = {
  readonly state: SubmitErrorState
  readonly store: {
    get: () => SubmitErrorState
    subscribe: (listener: (state: SubmitErrorState) => void) => {
      unsubscribe: () => void
    }
  }
}

type SubmitError = {
  /** What the submit handler threw. */
  readonly error: unknown
}

type Entry = SubmitError & SubmitErrorState

const entries = new WeakMap<object, Entry>()
const listeners = new WeakMap<object, Set<() => void>>()

/**
 * Record that `form`'s submit threw `error`. `<Form>` and `FormDialog` call it
 * when `handleSubmit()` rejects; call it from a submit path of your own. The
 * error lasts until the values change or the next submit starts, so an edit
 * or a retry clears it.
 */
function setSubmitError(form: SubmitErrorForm, error: unknown): void {
  const { submissionAttempts, values } = form.state
  entries.set(form.store, { error, submissionAttempts, values })
  for (const listener of listeners.get(form.store) ?? []) {
    listener()
  }
}

/**
 * The error `form`'s last submit threw, or `undefined` once the values have
 * changed or another submit has started since.
 */
function useSubmitError(form: SubmitErrorForm): SubmitError | undefined {
  const key = form.store
  const subscribe = useCallback(
    (listener: () => void) => {
      const set = listeners.get(key) ?? new Set()
      listeners.set(key, set)
      set.add(listener)
      return () => {
        set.delete(listener)
      }
    },
    [key]
  )
  const entry = useSyncExternalStore(
    subscribe,
    () => entries.get(key),
    () => undefined
  )
  // An edit replaces `values`, and every submit, valid or not, counts an
  // attempt; `reset()` does both.
  const isCurrent = useSelector(
    form.store,
    (state) =>
      entry !== undefined &&
      state.values === entry.values &&
      state.submissionAttempts === entry.submissionAttempts
  )
  return isCurrent ? entry : undefined
}

export type { SubmitError, SubmitErrorForm }
export { setSubmitError, useSubmitError }
