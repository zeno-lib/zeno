"use client"

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
    subscribe: (listener: () => void) => { unsubscribe: () => void }
  }
}

type SubmitError = {
  /** What the submit handler threw. */
  readonly error: unknown
}

type Entry = {
  readonly submitError: SubmitError
  readonly unsubscribe: () => void
}

const entries = new WeakMap<object, Entry>()
const listeners = new WeakMap<object, Set<() => void>>()

function notify(key: object): void {
  for (const listener of listeners.get(key) ?? []) {
    listener()
  }
}

function clear(key: object): void {
  const entry = entries.get(key)
  if (entry) {
    entry.unsubscribe()
    entries.delete(key)
    notify(key)
  }
}

// Next.js `redirect()`, `notFound()`, `forbidden()` and `unauthorized()` throw
// an error whose `digest` starts with `NEXT_`, and a server action that calls
// one rejects with it on the client. Next navigates on its own: no failure.
function isNavigationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false
  }
  return typeof error.digest === "string" && error.digest.startsWith("NEXT_")
}

/**
 * Record that `form`'s submit threw `error`. `useForm` calls it for what
 * `onSubmit` throws; call it for a failure your own submit code catches
 * outside `onSubmit`. The error lasts until the values change or the next
 * submit starts (`reset()` does both), so an edit or a retry clears it. A
 * Next.js navigation (`redirect()`, `notFound()`) is ignored.
 */
function setSubmitError(form: SubmitErrorForm, error: unknown): void {
  if (isNavigationError(error)) {
    return
  }
  const key = form.store
  entries.get(key)?.unsubscribe()
  const { submissionAttempts, values } = form.state
  // Dropped, not just hidden, once stale: a reset restores the attempt count
  // and can restore the same values object, which would bring it back.
  const subscription = form.store.subscribe(() => {
    const { state } = form
    if (
      state.values !== values ||
      state.submissionAttempts !== submissionAttempts
    ) {
      clear(key)
    }
  })
  entries.set(key, {
    submitError: { error },
    unsubscribe: subscription.unsubscribe,
  })
  notify(key)
}

/**
 * Report a submit rejection that is caught so the user can retry, as
 * `<Form>` and `FormDialog` do: `reportError` logs it and passes it to the
 * page's `error` listeners (where error monitoring hooks in), as if it were
 * uncaught. A Next.js navigation is skipped.
 */
function reportSubmitError(error: unknown): void {
  if (!isNavigationError(error)) {
    // Missing in jsdom and older browsers.
    globalThis.reportError?.(error)
  }
}

/** The error `form`'s last submit threw, until it went stale. */
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
  return useSyncExternalStore(
    subscribe,
    () => entries.get(key)?.submitError,
    () => undefined
  )
}

export type { SubmitError, SubmitErrorForm }
export { reportSubmitError, setSubmitError, useSubmitError }
