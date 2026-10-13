/**
 * Move focus to the first invalid control inside `root` (a `<form>`): the
 * first element with `aria-invalid="true"`, or, for a group root that can't
 * take focus itself (radio group, slider), its first tabbable descendant. An
 * invalid control that won't take focus (disabled, hidden) is skipped for the
 * next one. Call it after `await form.handleSubmit()` leaves the form invalid.
 * Searching only `root` keeps focus inside the submitted form, so a dialog's
 * form never sends it to the page behind. Returns the focused element, or
 * `null`.
 */
function focusFirstInvalid(
  root: ParentNode | null | undefined
): HTMLElement | null {
  const invalid = root?.querySelectorAll<HTMLElement>('[aria-invalid="true"]')
  for (const element of invalid ?? []) {
    for (const target of [
      element,
      ...element.querySelectorAll<HTMLElement>("*"),
    ]) {
      if (target.tabIndex < 0) {
        continue
      }
      target.focus()
      if (target.ownerDocument.activeElement === target) {
        return target
      }
    }
  }
  return null
}

export { focusFirstInvalid }
