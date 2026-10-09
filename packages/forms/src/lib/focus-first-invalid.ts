/**
 * Find the first invalid control inside `root` (a `<form>`): the first element
 * with `aria-invalid="true"`, or, for a group root that can't take focus itself
 * (radio group, slider), its first tabbable descendant. Searching only `root`
 * keeps focus inside the submitted form, so a dialog's form never sends it to
 * the page behind.
 */
function findFirstInvalid(
  root: ParentNode | null | undefined
): HTMLElement | null {
  const invalid = root?.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (!invalid) {
    return null
  }
  return (
    [invalid, ...invalid.querySelectorAll<HTMLElement>("*")].find(
      (element) => element.tabIndex >= 0
    ) ?? null
  )
}

/**
 * Focus `findFirstInvalid(root)`. Call it after `await form.handleSubmit()`
 * leaves the form invalid. Returns the focused element, or `null`.
 */
function focusFirstInvalid(
  root: ParentNode | null | undefined
): HTMLElement | null {
  const target = findFirstInvalid(root)
  target?.focus()
  return target
}

/**
 * Give focus back to `element`, what had it when the submit started, if the
 * submit dropped it to the body. A submit button that disables itself while
 * submitting does that in browsers, so a failed submit with no invalid field
 * to focus would otherwise leave the user nowhere. Returns whether it moved
 * focus.
 */
function restoreFocus(element: Element | null): boolean {
  if (!(element instanceof HTMLElement && element.isConnected)) {
    return false
  }
  const active = element.ownerDocument.activeElement
  if (active !== null && active !== element.ownerDocument.body) {
    return false
  }
  element.focus()
  return element.ownerDocument.activeElement === element
}

export { findFirstInvalid, focusFirstInvalid, restoreFocus }
