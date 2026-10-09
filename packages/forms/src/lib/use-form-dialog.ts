"use client"

import { useCallback, useRef, useState } from "react"

type FormDialogOpenOptions<TValues> = {
  /**
   * Values to edit in this session. Omit to start from the hook's
   * `defaultValues` (a blank "create" form).
   */
  defaultValues?: TValues
  /** Field `name` to focus once the dialog opens, e.g. `"email"`. */
  focus?: string
}

type UseFormDialogOptions<TValues> = {
  /** Values a session starts from when `open()` gets none. */
  defaultValues?: TValues
}

type FormDialogController<TValues> = {
  /** Whether the dialog is open. */
  isOpen: boolean
  /** Open a new editing session, optionally with its own values and focus. */
  open: (options?: FormDialogOpenOptions<TValues>) => void
  /**
   * Close without the unsaved-changes prompt. Close affordances inside the
   * dialog (Cancel, ×, Escape, outside press) go through the guard instead.
   */
  close: () => void
  /**
   * The current session's defaults. Pass them to `useForm({ defaultValues })`
   * so the form's defaults follow the session (see the pitfall below).
   */
  defaultValues: TValues | undefined
  /** Field to focus when the current session opened. */
  focus: string | undefined
  /** Increments on every `open()`; lets the dialog reset once per session. */
  session: number
}

type SessionState<TValues> = {
  isOpen: boolean
  defaultValues: TValues | undefined
  focus: string | undefined
  session: number
}

/**
 * Open/close state for a dialog-hosted form, one "session" per `open()`.
 *
 * Why the hook owns the defaults: TanStack Form ignores new `defaultValues`
 * once the form is touched, and a `form.reset(values)` is undone on the next
 * render when `useForm` still receives the old `defaultValues` (the form is
 * untouched again after the reset, so TanStack re-applies its options).
 * Passing `dialog.defaultValues` to `useForm` keeps the two in agreement;
 * the `FormDialog` component then calls `form.reset(defaults)` at the start
 * of every session.
 */
function useFormDialog<TValues>(
  options: UseFormDialogOptions<TValues> = {}
): FormDialogController<TValues> {
  const latestDefaults = useRef(options.defaultValues)
  latestDefaults.current = options.defaultValues

  const [state, setState] = useState<SessionState<TValues>>(() => ({
    defaultValues: options.defaultValues,
    focus: undefined,
    isOpen: false,
    session: 0,
  }))

  const open = useCallback((openOptions?: FormDialogOpenOptions<TValues>) => {
    setState((previous) => ({
      defaultValues: openOptions?.defaultValues ?? latestDefaults.current,
      focus: openOptions?.focus,
      isOpen: true,
      session: previous.session + 1,
    }))
  }, [])

  const close = useCallback(() => {
    setState((previous) =>
      previous.isOpen ? { ...previous, isOpen: false } : previous
    )
  }, [])

  return {
    close,
    defaultValues: state.defaultValues,
    focus: state.focus,
    isOpen: state.isOpen,
    open,
    session: state.session,
  }
}

type UseLeaveGuardOptions = {
  /** Whether leaving now would lose changes. */
  hasUnsavedChanges: boolean
  /**
   * Save the changes and resolve whether that worked. Backs `saveAndLeave`,
   * so the confirm UI can offer Save next to Discard.
   */
  onSave?: () => boolean | Promise<boolean>
}

type LeaveGuard = {
  /**
   * Run `proceed` now when there's nothing to lose, otherwise hold it until
   * the user confirms. A newer request replaces a held one.
   */
  requestLeave: (proceed: () => void) => void
  /** Whether a leave is waiting on the user's answer (show your confirm UI). */
  isConfirming: boolean
  /** The user chose to discard: run the held leave. */
  confirmLeave: () => void
  /** The user chose to stay: drop the held leave. */
  cancelLeave: () => void
  /**
   * The user chose to save: run `onSave`, then the held leave if it saved.
   * Either way the confirm UI closes; after a failed save the user stays.
   * Resolves whether it saved. A rejection from `onSave` keeps the leave held
   * and propagates.
   */
  saveAndLeave: () => Promise<boolean>
  /** Whether `saveAndLeave` is waiting on `onSave`. */
  isSaving: boolean
}

/** Ask before a leave (close, navigate, switch record) drops unsaved changes. */
function useLeaveGuard({
  hasUnsavedChanges,
  onSave,
}: UseLeaveGuardOptions): LeaveGuard {
  const pending = useRef<(() => void) | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const requestLeave = useCallback(
    (proceed: () => void) => {
      if (!hasUnsavedChanges) {
        proceed()
        return
      }
      pending.current = proceed
      setIsConfirming(true)
    },
    [hasUnsavedChanges]
  )

  const confirmLeave = useCallback(() => {
    const proceed = pending.current
    pending.current = null
    setIsConfirming(false)
    proceed?.()
  }, [])

  const cancelLeave = useCallback(() => {
    pending.current = null
    setIsConfirming(false)
  }, [])

  const saveAndLeave = useCallback(async () => {
    const proceed = pending.current
    if (!(proceed && onSave)) {
      return false
    }
    setIsSaving(true)
    let saved = false
    try {
      saved = await onSave()
    } finally {
      setIsSaving(false)
    }
    // Answered otherwise while saving (cancelled, or a newer leave replaced
    // this one): leave that answer alone.
    if (pending.current !== proceed) {
      return saved
    }
    pending.current = null
    setIsConfirming(false)
    if (saved) {
      proceed()
    }
    return saved
  }, [onSave])

  return {
    cancelLeave,
    confirmLeave,
    isConfirming,
    isSaving,
    requestLeave,
    saveAndLeave,
  }
}

const FOCUSABLE =
  'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function attributeSelector(attribute: string, value: string): string {
  return `[${attribute}="${value.replace(/["\\]/g, "\\$&")}"]`
}

/**
 * Find the element to focus for field `name` inside `root`: the control with
 * `id={name}` (fields that use the name as their id), else, inside the field
 * root marked `data-field={name}`, the control its label points at (the shipped
 * fields' ids come from `useId`), else that root's first focusable element.
 */
function findFieldElement(
  root: ParentNode | null | undefined,
  name: string
): HTMLElement | null {
  if (!root) {
    return null
  }
  const byId = root.querySelector<HTMLElement>(attributeSelector("id", name))
  if (byId) {
    return byId
  }
  const fieldRoot = root.querySelector(attributeSelector("data-field", name))
  if (!fieldRoot) {
    return null
  }
  const labelFor = fieldRoot.querySelector("label[for]")?.getAttribute("for")
  const labelled = labelFor
    ? fieldRoot.querySelector<HTMLElement>(attributeSelector("id", labelFor))
    : null
  return labelled ?? fieldRoot.querySelector<HTMLElement>(FOCUSABLE)
}

export type {
  FormDialogController,
  FormDialogOpenOptions,
  LeaveGuard,
  UseFormDialogOptions,
  UseLeaveGuardOptions,
}
export { findFieldElement, useFormDialog, useLeaveGuard }
