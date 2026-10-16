"use client"

import type { AnyFormApi } from "@tanstack/react-form"
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useSyncExternalStore,
} from "react"

import { formContext } from "./contexts"

// `useForm({ disabled })`, per form. Keyed by `form.store`, as the rest of the
// per-form Zeno state is (`validation-modes.ts`), and read through
// `useSyncExternalStore`, so a toggle re-renders every field, a memoized one
// or one with no provider above it included.
const disabledOption = new WeakMap<object, boolean>()
const listeners = new WeakMap<object, Set<() => void>>()

function subscribe(key: object, listener: () => void): () => void {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

/** Apply `useForm({ disabled })` to `form`. */
function useDisabledOption(form: AnyFormApi, disabled: boolean): void {
  const key = form.store
  // Seeded while rendering, so the first render, the server's included,
  // already has it. A change lands on commit, so a render React drops (a
  // suspended transition) never reaches the fields.
  if (!disabledOption.has(key)) {
    disabledOption.set(key, disabled)
  }
  useLayoutEffect(() => {
    if (disabledOption.get(key) === disabled) {
      return
    }
    disabledOption.set(key, disabled)
    for (const listener of listeners.get(key) ?? []) {
      listener()
    }
  }, [key, disabled])
}

type FormDisabledScope = {
  readonly disabled: boolean
  /** The `store` of the form it disables. */
  readonly key: object
}

/**
 * The disabled state `FormProvider` and `<Form>` give what they wrap, for
 * their own form only: a field of another form rendered inside (a quick-add
 * popover) keeps that form's state.
 */
const FormDisabledContext = createContext<FormDisabledScope | null>(null)

/**
 * Whether the form is disabled, by `useForm({ disabled })`,
 * `<FormProvider disabled>`, `<Form disabled>` or `FormDialog`'s `disabled`.
 * Every kit field reads it, so a control the fieldset of a disabled dialog
 * can't reach (a checkbox, a switch, a radio, a slider) turns off too.
 *
 * Reads the form of the nearest provider; inside a field, pass `field.form`.
 * `useForm({ disabled })` applies even where no provider of the form is
 * mounted.
 */
function useIsFormDisabled(form?: AnyFormApi): boolean {
  const scope = useContext(FormDisabledContext)
  const contextForm = useContext(formContext) as AnyFormApi | null
  const key = (form ?? contextForm)?.store
  const subscribeToKey = useCallback(
    (listener: () => void) => (key ? subscribe(key, listener) : () => null),
    [key]
  )
  const getSnapshot = () => (key ? (disabledOption.get(key) ?? false) : false)
  const byOption = useSyncExternalStore(
    subscribeToKey,
    getSnapshot,
    getSnapshot
  )
  const byScope =
    scope?.disabled === true && (key === undefined || scope.key === key)
  return byScope || byOption
}

export { FormDisabledContext, useDisabledOption, useIsFormDisabled }
