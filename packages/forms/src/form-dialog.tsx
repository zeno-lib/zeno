"use client"

import { FormProvider } from "@zeno-lib/forms"
import {
  type FormDialogController,
  findFieldElement,
  useLeaveGuard,
} from "@zeno-lib/forms/lib/use-form-dialog"
import { useUnsavedChangesWarning } from "@zeno-lib/forms/lib/use-unsaved-changes-warning"
import { type AnyFormApi, useSelector } from "@zeno-lib/forms/tanstack"
import {
  type FormEvent,
  type ReactElement,
  type ReactNode,
  useId,
  useLayoutEffect,
  useRef,
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

type DiscardPromptText = {
  title?: ReactNode
  description?: ReactNode
  confirmLabel?: ReactNode
  cancelLabel?: ReactNode
}

// The slice of the `useForm()` API the dialog uses. Structural, so any Zeno /
// TanStack form fits whatever its validator and submit-meta generics are.
type DialogFormState = {
  isDefaultValue: boolean
  isSubmitSuccessful: boolean
  isSubmitting: boolean
  isValid: boolean
}

type DialogForm<TValues> = {
  store: {
    get: () => DialogFormState
    subscribe: (listener: (state: DialogFormState) => void) => {
      unsubscribe: () => void
    }
  }
  readonly state: DialogFormState
  handleSubmit(): unknown
  reset(values?: TValues): void
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
   * Ask before closing with unsaved changes, and warn on page unload while
   * open. Defaults to `true`.
   */
  guard?: boolean
  /** Copy for the discard prompt. */
  discardPrompt?: DiscardPromptText
  /** Class for the dialog popup (e.g. a wider `sm:max-w-lg`). */
  className?: string
  /** Class for the `<form>` element. */
  formClassName?: string
}

/**
 * A dialog-hosted form: opens with fresh values per session, submits from a
 * footer button outside the `<form>` (via `form="id"`), shows a spinner while
 * submitting, closes on success, and asks before discarding unsaved changes
 * (Cancel, ×, Escape, outside press) or leaving the page.
 */
function FormDialog<TValues>({
  cancelLabel = "Cancel",
  children,
  className,
  closeOnSubmit = true,
  description,
  dialog,
  discardPrompt,
  footer,
  form,
  formClassName,
  guard = true,
  submitLabel = "Save",
  title,
  trigger,
}: FormDialogProps<TValues>) {
  const formId = useId()
  const popupRef = useRef<HTMLDivElement>(null)
  const { close, defaultValues, focus, isOpen, open, session } = dialog

  // `isDefaultValue`, not `isDirty`: `isDirty` stays true after the user
  // reverts an edit, `isDefaultValue` compares the values themselves.
  const hasChanges = useSelector(form.store, (state) => !state.isDefaultValue)
  const isSubmitting = useSelector(form.store, (state) => state.isSubmitting)
  const { cancelLeave, confirmLeave, isConfirming, requestLeave } =
    useLeaveGuard({ hasUnsavedChanges: guard && hasChanges })
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    event.stopPropagation()
    try {
      await form.handleSubmit()
    } catch {
      return // the submit handler threw; keep the dialog open
    }
    const { isSubmitSuccessful, isValid } = form.state
    if (closeOnSubmit && isSubmitSuccessful && isValid) {
      // Close directly, past the guard: the changes are saved. The form is
      // reset once the exit animation completes (see `onOpenChangeComplete`).
      close()
    }
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
          const target = focus
            ? findFieldElement(popupRef.current, focus)
            : null
          return target ?? true
        }}
        ref={popupRef}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <FormProvider form={form}>
          <form
            className={formClassName}
            id={formId}
            noValidate
            onSubmit={handleSubmit}
          >
            {children}
          </form>
        </FormProvider>
        <DialogFooter>
          {footer}
          <DialogClose render={<Button type="button" variant="outline" />}>
            {cancelLabel}
          </DialogClose>
          <Button disabled={isSubmitting} form={formId} type="submit">
            {isSubmitting && <Spinner />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
      {/* Inside the Dialog root (so it nests over the form) but outside the
          popup (so it can finish its own exit animation). */}
      <AlertDialog
        onOpenChange={(next) => {
          if (!next) {
            cancelLeave()
          }
        }}
        open={isConfirming}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {discardPrompt?.title ?? "Discard changes?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {discardPrompt?.description ??
                "Your unsaved changes will be lost."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {discardPrompt?.cancelLabel ?? "Keep editing"}
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmLeave} variant="destructive">
              {discardPrompt?.confirmLabel ?? "Discard"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  )
}

export type { DialogForm, DiscardPromptText, FormDialogProps }
export { FormDialog }
