"use client"

import type { AnyFormApi } from "@tanstack/react-form"

// Tracks the `<form>` DOM node each form renders into, so behaviour that needs
// the DOM (focusing the first invalid control) stays scoped to that form. A
// form inside a dialog must not steal focus from, or hand it to, a form behind
// it. Keyed by `form.store` for the same reason as `validation-modes.ts`: it's
// the one reference shared by the `useForm` result and every `field.form`.
const formElements = new WeakMap<object, HTMLFormElement>()

function storeKey(form: AnyFormApi): object {
  return (form as { store: object }).store
}

function setFormElement(
  form: AnyFormApi,
  element: HTMLFormElement | null
): void {
  const key = storeKey(form)
  if (element) {
    formElements.set(key, element)
  } else {
    formElements.delete(key)
  }
}

function getFormElement(form: AnyFormApi): HTMLFormElement | undefined {
  return formElements.get(storeKey(form))
}

const FOCUSABLE = [
  "input",
  "select",
  "textarea",
  "button",
  "[tabindex]",
  '[contenteditable="true"]',
]
  .map(
    (selector) =>
      `${selector}:not([disabled]):not([tabindex="-1"]):not([type="hidden"])`
  )
  .join(", ")

/**
 * Focus the first `[aria-invalid="true"]` element inside `root`, in document
 * order. When the invalid element itself isn't focusable (a radio group or
 * slider root), its first focusable descendant gets focus instead. Returns the
 * focused element, or `undefined` if nothing was focusable.
 */
function focusFirstInvalid(
  root: ParentNode | null | undefined
): HTMLElement | undefined {
  if (!root) {
    return
  }
  for (const invalid of root.querySelectorAll<HTMLElement>(
    '[aria-invalid="true"]'
  )) {
    const target = invalid.matches(FOCUSABLE)
      ? invalid
      : invalid.querySelector<HTMLElement>(FOCUSABLE)
    if (target) {
      target.focus()
      return target
    }
  }
  return
}

// Fields flip `aria-invalid` on the render that follows the failed submit, so
// wait a macrotask for React to commit before looking for them.
function scheduleFocusFirstInvalid(form: AnyFormApi): void {
  setTimeout(() => {
    focusFirstInvalid(getFormElement(form))
  }, 0)
}

export {
  focusFirstInvalid,
  getFormElement,
  scheduleFocusFirstInvalid,
  setFormElement,
}
