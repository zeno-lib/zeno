import { afterEach, describe, expect, test } from "vitest"
import { focusFirstInvalid } from "./focus-first-invalid"

afterEach(() => {
  document.body.innerHTML = ""
})

describe("focusFirstInvalid", () => {
  test("skips an invalid control that won't take focus", () => {
    document.body.innerHTML = `
      <form>
        <input aria-invalid="true" disabled name="locked" />
        <div aria-invalid="true" role="radiogroup">
          <button disabled role="radio" type="button">A</button>
          <button role="radio" type="button">B</button>
        </div>
      </form>`
    const focused = focusFirstInvalid(document.querySelector("form"))
    expect(focused?.textContent).toBe("B")
    expect(document.activeElement).toBe(focused)
  })
})
