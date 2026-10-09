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

export { findFirstInvalid, focusFirstInvalid }
