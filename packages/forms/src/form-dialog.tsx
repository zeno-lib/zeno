"use client"

import { FormProvider } from "@zeno-lib/forms"
import {
  findFirstInvalid,
  focusFirstInvalid,
  restoreFocus,
} from "@zeno-lib/forms/lib/focus-first-invalid"
import { setSubmitError } from "@zeno-lib/forms/lib/submit-error"
import {
  type FormDialogController,
  findFieldElement,
  useLeaveGuard,
} from "@zeno-lib/forms/lib/use-form-dialog"
import { useUnsavedChangesWarning } from "@zeno-lib/forms/lib/use-unsaved-changes-warning"
import { type AnyFormApi, useSelector } from "@zeno-lib/forms/tanstack"
import {
  type FormEvent,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { FormError } from "./fields/form-error"

type DiscardPromptText = {
  title?: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
  /** The Save action's label (`saveFromPrompt`). Defaults to `submitLabel`. */
  saveLabel?: ReactNode
}

// The slice of the `useForm()` API the dialog uses. Structural, so any Zeno /
// TanStack form fits whatever its validator and submit-meta generics are.
type DialogFormState = {
  isDefaultValue: boolean
  isSubmitSuccessful: boolean
  isSubmitting: boolean
  isValid: boolean
  submissionAttempts: number
  values: unknown
}

type DialogForm<TValues> = {
  store: {
    get: () => DialogFormState
    subscribe: (listener: (state: DialogFormState) => void) => {
      unsubscribe: () => void
    }
  }
  readonly state: DialogFormState
  handleSubmit: () => unknown
  reset: (values?: TValues) => void
}

type FormDialogProps<TValues> = {
  /** The controller from `useFormDialog()`. */
  dialog: FormDialogController<TValues>
  /** The form from `useForm()`; its `onSubmit` runs on Save. */
  form: DialogForm<TValues>
  title: ReactNode
  description?: ReactNode
  /** The fields. Rendered inside the `<form>`. */
  children: ReactNode
  /** Element that opens the dialog (with the hook's defaults) on click. */
  trigger?: ReactElement
  /** Defaults to `"Save"`. */
  submitLabel?: ReactNode
  /** Defaults to `"Cancel"`. */
  cancelLabel?: ReactNode
  /** Extra footer content, rendered before Cancel / Save. */
  footer?: ReactNode
  /** Close after a successful submit. Defaults to `true`. */
  closeOnSubmit?: boolean
  /**
   * Shown above the footer when the submit handler throws. Defaults to
   * `FormError`'s `"Something went wrong. Try again."`. A function gets what
   * was thrown.
   */
  submitErrorMessage?: ReactNode | ((error: unknown) => ReactNode)
  /**
   * Ask before closing with unsaved changes, and warn on page unload while
   * open. Defaults to `true`.
   */
  guard?: boolean
  /** Copy for the discard prompt. */
  discardPrompt?: DiscardPromptText
  /**
   * Offer Save in the discard prompt, next to Discard: it submits, and closes
   * the dialog if the submit succeeds. Defaults to `false`.
   */
  saveFromPrompt?: boolean
  /**
   * Disable Save, ⌘/Ctrl+Enter, and the native controls in the form (through
   * a `<fieldset disabled>`). Defaults to `false`.
   */
  disabled?: boolean
  /** Class for the dialog popup (e.g. a wider `sm:max-w-lg`). */
  className?: string
  /** Class for the `<form>` element. */
  formClassName?: string
}

/**
 * A dialog-hosted form: opens with fresh values and fields per session,
 * submits from a footer button outside the `<form>` (via `form="id"`), shows a
 * spinner while submitting, also submits on ⌘/Ctrl+Enter, focuses the first
 * invalid field when the submit fails, shows a form-level error (or a thrown
 * submit) above the footer, closes on success, and asks before discarding
 * unsaved changes (Cancel, ×, Escape, outside press) or leaving the page.
 */
function FormDialog<TValues>({
  cancelLabel = "Cancel",
  children,
  className,
  closeOnSubmit = true,
  description,
  dialog,
  disabled = false,
  discardPrompt,
  footer,
  form,
  formClassName,
  guard = true,
  saveFromPrompt = false,
  submitErrorMessage,
  submitLabel = "Save",
  title,
  trigger,
}: FormDialogProps<TValues>) {
  const formId = useId()
  const popupRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  // Set when a Save from the discard prompt fails, so the prompt hands focus
  // to the first invalid field as it closes.
  const focusInvalidOnPromptClose = useRef<boolean>(false)
  // The open prompt hides the dialog from assistive tech, so the form-level
  // error a failed Save from it renders is never announced. Remount the
  // error once the prompt has closed, which announces it.
  const announceOnPromptClosed = useRef<boolean>(false)
  const [formErrorKey, setFormErrorKey] = useState(0)
  const { close, defaultValues, focus, isOpen, open, session } = dialog

  // `isDefaultValue`, not `isDirty`: `isDirty` stays true after the user
  // reverts an edit, `isDefaultValue` compares the values themselves.
  const hasChanges = useSelector(form.store, (state) => !state.isDefaultValue)
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)
  const {
    cancelLeave,
    confirmLeave,
    isConfirming,
    isSaving,
    requestLeave,
    saveAndLeave,
  } = useLeaveGuard({
    hasUnsavedChanges: guard && hasChanges,
    onSave: async () => {
      const saved = await submit()
      focusInvalidOnPromptClose.current = !saved
      announceOnPromptClosed.current = !saved
      return saved
    },
  })
  useUnsavedChangesWarning(
    form as unknown as AnyFormApi,
    guard && isOpen ? "if-changed" : false
  )

  // Start every session from its own defaults. `reset(values)` also rebases
  // the form's defaults, so the session's values count as "unchanged".
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per session.
  useLayoutEffect(() => {
    if (session > 0) {
      form.reset(defaultValues)
    }
  }, [session])

  // Resolves whether the form saved. A submit handler that throws leaves
  // `isSubmitSuccessful` false, so the dialog stays open, and becomes the
  // form-level error `FormError` shows.
  async function submit(): Promise<boolean> {
    await Promise.resolve(form.handleSubmit()).catch((error: unknown) =>
      setSubmitError(form, error)
    )
    const { isSubmitSuccessful, isValid } = form.state
    return isValid && isSubmitSuccessful
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const node = event.currentTarget
    const focused = node.ownerDocument.activeElement
    const saved = await submit()
    if (saved) {
      if (closeOnSubmit) {
        // Close directly, past the guard: the changes are saved. The form is
        // reset once the exit animation completes (see `onOpenChangeComplete`).
        close()
      }
      return
    }
    // A schema error, or a field error the server returned (`submitAction`).
    if (!form.state.isValid && focusFirstInvalid(node)) {
      return
    }
    // A form-level error has no field to fix, so focus stays where it was:
    // on Save, or the field ⌘/Ctrl+Enter was pressed in. Disabling Save while
    // submitting drops its focus to the body, so give it back.
    restoreFocus(focused)
  }

  // ⌘/Ctrl+Enter submits from anywhere in the popup, a textarea included
  // (plain Enter there inserts a line break). The discard prompt is outside
  // the popup, so its keys never get here.
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      event.key !== "Enter" ||
      !(event.metaKey || event.ctrlKey) ||
      event.repeat ||
      event.nativeEvent.isComposing ||
      disabled ||
      isSubmitting ||
      isConfirming
    ) {
      return
    }
    event.preventDefault()
    formRef.current?.requestSubmit()
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (next) {
          open()
        } else {
          requestLeave(close)
        }
      }}
      onOpenChangeComplete={(opened) => {
        // Drop abandoned edits once the close animation is done, so the
        // fields don't visibly snap back while fading out.
        if (!opened) {
          form.reset()
        }
      }}
      open={isOpen}
    >
      {trigger && <DialogTrigger render={trigger} />}
      <DialogContent
        className={className}
        initialFocus={() => {
          // A disabled control can't take focus.
          const target =
            focus && !disabled
              ? findFieldElement(popupRef.current, focus)
              : null
          return target ?? true
        }}
        onKeyDown={handleKeyDown}
        ref={popupRef}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormProvider form={form}>
          {/* Around the <form>, not inside it, so `formClassName` child
              selectors (`space-y-4`) still reach the fields. `min-w-0` is
              for a browser that ignores `contents` on a fieldset. */}
          <fieldset className="contents min-w-0" disabled={disabled}>
            {/* Keyed on the session so every open mounts fresh fields. The
                popup stays mounted through its exit animation, so reopening
                before it ends would keep each field's local state (and any
                custom child's) from the previous session. */}
            <form
              className={formClassName}
              id={formId}
              key={session}
              noValidate
              onSubmit={handleSubmit}
              ref={formRef}
            >
              {children}
            </form>
          </fieldset>
          {/* Next to the Save button that failed, and outside the <form>, so
              it stays in view when the fields scroll and adds no child for
              `formClassName` selectors to match. */}
          <FormError
            key={formErrorKey}
            submitErrorMessage={submitErrorMessage}
          />
        </FormProvider>
        <DialogFooter>
          {footer}
          <DialogClose render={<Button type="button" variant="outline" />}>
            {cancelLabel}
          </DialogClose>
          <Button
            disabled={disabled || isSubmitting}
            form={formId}
            type="submit"
          >
            {isSubmitting && <Spinner />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
      {/* Inside the Dialog root (so it nests over the form) but outside the
          popup (so it can finish its own exit animation). */}
      <AlertDialog
        onOpenChange={(next) => {
          // Stay open while a Save from the prompt is in flight.
          if (!(next || isSaving)) {
            cancelLeave()
          }
        }}
        onOpenChangeComplete={(opened) => {
          if (!opened && announceOnPromptClosed.current) {
            announceOnPromptClosed.current = false
            setFormErrorKey((key) => key + 1)
          }
        }}
        open={isConfirming}
      >
        <AlertDialogContent
          // The prompt traps focus while open, so a failed Save's invalid
          // field gets focus as the prompt closes, not from `submit`.
          finalFocus={() => {
            if (!focusInvalidOnPromptClose.current) {
              return true
            }
            focusInvalidOnPromptClose.current = false
            return findFirstInvalid(formRef.current) ?? true
          }}
          size={saveFromPrompt ? "default" : "sm"}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {discardPrompt?.title ??
                (saveFromPrompt ? "Save changes?" : "Discard changes?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {discardPrompt?.description ??
                (saveFromPrompt
                  ? "Your unsaved changes will be lost unless you save them."
                  : "Your unsaved changes will be lost.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSaving}>
              {discardPrompt?.cancelLabel ?? "Keep editing"}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              onClick={confirmLeave}
              variant="destructive"
            >
              {discardPrompt?.confirmLabel ?? "Discard"}
            </AlertDialogAction>
            {saveFromPrompt && (
              <AlertDialogAction disabled={isSaving} onClick={saveAndLeave}>
                {isSaving && <Spinner />}
                {discardPrompt?.saveLabel ?? submitLabel}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

export type { DialogForm, DiscardPromptText, FormDialogProps }
export { FormDialog }
