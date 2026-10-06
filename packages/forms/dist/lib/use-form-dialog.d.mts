//#region src/lib/use-form-dialog.d.ts
type FormDialogOpenOptions<TValues> = {
  /**
   * Values to edit in this session. Omit to start from the hook's
   * `defaultValues` (a blank "create" form).
   */
  defaultValues?: TValues;
  /** Field `name` to focus once the dialog opens, e.g. `"email"`. */
  focus?: string;
};
type UseFormDialogOptions<TValues> = {
  /** Values a session starts from when `open()` gets none. */
  defaultValues?: TValues;
};
type FormDialogController<TValues> = {
  /** Whether the dialog is open. */
  isOpen: boolean;
  /** Open a new editing session, optionally with its own values and focus. */
  open: (options?: FormDialogOpenOptions<TValues>) => void;
  /**
   * Close without the unsaved-changes prompt. Close affordances inside the
   * dialog (Cancel, ×, Escape, outside press) go through the guard instead.
   */
  close: () => void;
  /**
   * The current session's defaults. Pass them to `useForm({ defaultValues })`
   * so the form's defaults follow the session (see the pitfall below).
   */
  defaultValues: TValues | undefined;
  /** Field to focus when the current session opened. */
  focus: string | undefined;
  /** Increments on every `open()`; lets the dialog reset once per session. */
  session: number;
};
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
declare function useFormDialog<TValues>(options?: UseFormDialogOptions<TValues>): FormDialogController<TValues>;
type UseLeaveGuardOptions = {
  /** Whether leaving now would lose changes. */
  hasUnsavedChanges: boolean;
};
type LeaveGuard = {
  /**
   * Run `proceed` now when there's nothing to lose, otherwise hold it until
   * the user confirms. A newer request replaces a held one.
   */
  requestLeave: (proceed: () => void) => void;
  /** Whether a leave is waiting on the user's answer (show your confirm UI). */
  isConfirming: boolean;
  /** The user chose to discard: run the held leave. */
  confirmLeave: () => void;
  /** The user chose to stay: drop the held leave. */
  cancelLeave: () => void;
};
/** Ask before a leave (close, navigate, switch record) drops unsaved changes. */
declare function useLeaveGuard({ hasUnsavedChanges }: UseLeaveGuardOptions): LeaveGuard;
/**
 * Find the element to focus for field `name` inside `root`: the control with
 * `id={name}` (what the shipped fields render), else the first focusable
 * element inside the field root marked `data-field={name}`.
 */
declare function findFieldElement(root: ParentNode | null | undefined, name: string): HTMLElement | null;
//#endregion
export { type FormDialogController, type FormDialogOpenOptions, type LeaveGuard, type UseFormDialogOptions, type UseLeaveGuardOptions, findFieldElement, useFormDialog, useLeaveGuard };