import { afterEach, describe, expect, test } from "vitest"

import { focusFirstInvalid } from "./form-dom"

afterEach(() => {
  document.body.innerHTML = ""
})

describe("focusFirstInvalid", () => {
  test("focuses the first invalid control in document order", () => {
    document.body.innerHTML = `
      <form>
        <input id="a" />
        <input id="b" aria-invalid="true" />
        <input id="c" aria-invalid="true" />
      </form>`
    const form = document.querySelector("form")
    expect(focusFirstInvalid(form)?.id).toBe("b")
    expect(document.activeElement?.id).toBe("b")
  })

  test("falls back to the first focusable descendant of a non-focusable invalid root", () => {
    document.body.innerHTML = `
      <form>
        <div role="radiogroup" aria-invalid="true">
          <span tabindex="-1" id="skip"></span>
          <button type="button" id="radio">A</button>
        </div>
      </form>`
    expect(focusFirstInvalid(document.querySelector("form"))?.id).toBe("radio")
  })

  test("ignores invalid controls outside the given root", () => {
    document.body.innerHTML = `
      <input id="outside" aria-invalid="true" />
      <form><input id="inside" /></form>`
    expect(focusFirstInvalid(document.querySelector("form"))).toBeUndefined()
    expect(document.activeElement).toBe(document.body)
  })

  test("no root is a no-op", () => {
    expect(focusFirstInvalid(undefined)).toBeUndefined()
  })
})
