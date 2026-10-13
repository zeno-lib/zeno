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

/**
 * Give focus back to `element`, what had it when the submit started, if the
 * submit dropped it to the body. A submit button that disables itself while
 * submitting does that in browsers, so a failed submit with no invalid field
 * to focus would otherwise leave the user nowhere. It doesn't scroll, so a
 * user who scrolled away during a slow submit stays put. Returns whether it
 * moved focus.
 */
function restoreFocus(element: Element | null): boolean {
  if (!(element instanceof HTMLElement && element.isConnected)) {
    return false
  }
  const active = element.ownerDocument.activeElement
  if (active !== null && active !== element.ownerDocument.body) {
    return false
  }
  element.focus({ preventScroll: true })
  return element.ownerDocument.activeElement === element
}

export { focusFirstInvalid, restoreFocus }
