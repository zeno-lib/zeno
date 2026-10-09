import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, onTestFinished, test, vi } from "vitest"
import { z } from "zod"
import { useForm } from "./create-form"
import { FormDialog } from "./form-dialog"
import type { ActionResult } from "./lib/action-result"
import { submitAction } from "./lib/submit-action"
import { useFormDialog } from "./lib/use-form-dialog"

const NAME = /Name/
const EMAIL = /Email/

const animatable = HTMLElement.prototype as {
  getAnimations?: () => unknown[]
}

afterEach(() => {
  animatable.getAnimations = undefined
  cleanup()
})

// jsdom runs no CSS animations, so Base UI unmounts a closing popup at once.
// Report an animation that never ends, as a browser does while the exit
// animation plays, so the popup stays mounted after it closes.
function holdExitAnimation() {
  animatable.getAnimations = () => [{ finished: new Promise(() => undefined) }]
}

const schema = z.object({
  email: z.string(),
  name: z.string().min(1, "Required"),
})
type Values = z.infer<typeof schema>
const BLANK: Values = { email: "", name: "" }
const ROW: Values = { email: "ada@example.com", name: "Ada" }

function Harness({
  action,
  children,
  onSubmit = vi.fn(),
  closeOnSubmit,
  disabled,
  saveFromPrompt,
  submitErrorMessage,
}: {
  /** Submit through `submitAction` with this server action instead. */
  action?: (values: Values) => Promise<ActionResult<unknown>>
  children?: ReactNode
  onSubmit?: (values: Values) => unknown
  closeOnSubmit?: boolean
  disabled?: boolean
  saveFromPrompt?: boolean
  submitErrorMessage?: (error: unknown) => ReactNode
}) {
  const dialog = useFormDialog({ defaultValues: BLANK })
  const form = useForm({
    defaultValues: dialog.defaultValues,
    onSubmit: (submit) =>
      action ? submitAction(submit, action) : onSubmit(submit.value),
    schema,
  })
  const { InputField } = form
  return (
    <>
      <button onClick={() => dialog.open()} type="button">
        New
      </button>
      <button
        onClick={() => dialog.open({ defaultValues: ROW, focus: "email" })}
        type="button"
      >
        Edit
      </button>
      <FormDialog
        closeOnSubmit={closeOnSubmit}
        dialog={dialog}
        disabled={disabled}
        form={form}
        saveFromPrompt={saveFromPrompt}
        submitErrorMessage={submitErrorMessage}
        title="Person"
      >
        <InputField label="Name" name="name" />
        <InputField label="Email" name="email" />
        {children}
      </FormDialog>
    </>
  )
}

// Browsers drop focus to the body when the focused Save button is disabled
// for the submit; jsdom keeps it there (and can't blur a disabled button).
// Drop it as a browser would: through an element that is then removed.
function dropFocus() {
  const sink = document.createElement("input")
  document.body.append(sink)
  sink.focus()
  sink.remove()
}

// The alerts added where assistive tech could see them. One added under an
// `aria-hidden` ancestor (the dialog, while the leave prompt is open) is never
// announced, not even once that ancestor is shown again.
function watchAnnouncedAlerts(): string[] {
  const announced: string[] = []
  const observer = new MutationObserver((records) => {
    for (const node of records.flatMap((record) => [...record.addedNodes])) {
      if (!(node instanceof Element)) {
        continue
      }
      for (const alert of [node, ...node.querySelectorAll("*")]) {
        if (
          alert.getAttribute("role") === "alert" &&
          !alert.closest('[aria-hidden="true"]')
        ) {
          announced.push(alert.textContent ?? "")
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })
  onTestFinished(() => observer.disconnect())
  return announced
}

// Open the "Edit" session and wait for its initial focus (on Email) to land,
// so later typing isn't raced by the dialog's focus management.
async function openEdit(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Edit" }))
  const email = await screen.findByLabelText(EMAIL)
  await waitFor(() => expect(document.activeElement).toBe(email))
  return screen.getByLabelText(NAME) as HTMLInputElement
}

describe("FormDialog", () => {
  test("opens with per-session defaults and focuses the requested field", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const name = await openEdit(user)
    expect(name.value).toBe("Ada")
  })

  test("closes without asking when nothing changed", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await openEdit(user)
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  test("asks before discarding, keeps editing on cancel, resets on discard", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.keyboard("{Escape}")

    await screen.findByRole("alertdialog")
    await user.click(screen.getByRole("button", { name: "Keep editing" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect((screen.getByLabelText(NAME) as HTMLInputElement).value).toBe("Ada!")

    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await user.click(await screen.findByRole("button", { name: "Discard" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    // Reopening a blank session shows the blank defaults, not the old edit.
    await user.click(screen.getByRole("button", { name: "New" }))
    expect(
      ((await screen.findByLabelText(NAME)) as HTMLInputElement).value
    ).toBe("")
  })

  test("reverting an edit counts as unchanged (isDefaultValue, not isDirty)", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const name = await openEdit(user)
    await user.type(name, "x{Backspace}")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  test("submits from the footer button and closes on success", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    const name = await openEdit(user)
    await user.type(name, "!")
    const save = screen.getByRole("button", { name: "Save" })
    expect(save.closest("form")).toBeNull()
    await user.click(save)
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        email: "ada@example.com",
        name: "Ada!",
      })
    )
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  test("stays open when validation fails or the submit throws", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => {
      throw new Error("nope")
    })
    render(<Harness onSubmit={onSubmit} />)
    await user.click(screen.getByRole("button", { name: "New" }))
    await screen.findByLabelText(NAME)
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText("Required")).toBeTruthy()

    await user.type(screen.getByLabelText(NAME), "Bob")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  test("a failed Save focuses the first invalid field", async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await user.click(screen.getByRole("button", { name: "New" }))
    const name = await screen.findByLabelText(NAME)
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Required")).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(name))
  })

  test("a field error from the server focuses that field", async () => {
    const user = userEvent.setup()
    const action = vi.fn(() =>
      Promise.resolve<ActionResult<never>>({
        error: { fieldErrors: { email: ["Already taken"] }, formErrors: [] },
        ok: false,
      })
    )
    render(<Harness action={action} />)
    await user.click(screen.getByRole("button", { name: "New" }))
    await user.type(await screen.findByLabelText(NAME), "Bob")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Already taken")).toBeTruthy()
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText(EMAIL))
    )
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  test("an action's form-level error shows in the dialog, focus back on Save", async () => {
    const user = userEvent.setup()
    const action = vi.fn(() => {
      dropFocus()
      return Promise.resolve<ActionResult<never>>({
        error: { fieldErrors: {}, formErrors: ["Record is locked"] },
        ok: false,
      })
    })
    render(<Harness action={action} />)
    const name = await openEdit(user)
    const save = screen.getByRole("button", { name: "Save" })
    await user.click(save)

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Record is locked")
    expect(screen.getByRole("dialog")).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(save))

    await user.type(name, "!")
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull())
  })

  test("a thrown submit shows a generic message until an edit or a resubmit", async () => {
    const user = userEvent.setup()
    let rejectRetry: (error: Error) => void = () => undefined
    const onSubmit = vi
      .fn<(values: Values) => unknown>()
      .mockImplementationOnce(() => {
        dropFocus()
        throw new Error("connect ECONNREFUSED 10.0.0.1:5432")
      })
      .mockImplementationOnce(() => {
        throw new Error("offline")
      })
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectRetry = reject
          })
      )
    render(<Harness onSubmit={onSubmit} />)
    const name = await openEdit(user)
    const save = screen.getByRole("button", { name: "Save" })
    await user.click(save)

    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Something went wrong. Try again.")
    expect(screen.getByRole("dialog")).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(save))

    await user.type(name, "!")
    expect(screen.queryByRole("alert")).toBeNull()

    await user.click(save)
    expect(await screen.findByRole("alert")).toBeTruthy()

    // The retry clears the message while it runs; it comes back if it fails.
    await user.click(save)
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(3))
    expect(screen.queryByRole("alert")).toBeNull()
    rejectRetry(new Error("offline"))
    expect(await screen.findByRole("alert")).toBeTruthy()
  })

  test("submitErrorMessage words the thrown-submit message from the error", async () => {
    const user = userEvent.setup()
    render(
      <Harness
        onSubmit={() => {
          throw new Error("Quota reached")
        }}
        submitErrorMessage={(error) => `Not saved: ${(error as Error).message}`}
      />
    )
    await openEdit(user)
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Not saved: Quota reached"
    )
  })

  test("reopening during the close animation mounts fresh fields", async () => {
    const user = userEvent.setup()
    function Details() {
      const [shown, setShown] = useState(false)
      return (
        <button
          aria-pressed={shown}
          onClick={() => setShown(true)}
          type="button"
        >
          Details
        </button>
      )
    }
    render(
      <Harness>
        <Details />
      </Harness>
    )
    await openEdit(user)
    await user.click(screen.getByRole("button", { name: "Details" }))
    expect(
      screen
        .getByRole("button", { name: "Details" })
        .getAttribute("aria-pressed")
    ).toBe("true")

    holdExitAnimation()
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    // Still mounted: the exit animation is running.
    expect(
      screen.queryByRole("button", { hidden: true, name: "Details" })
    ).not.toBeNull()
    const name = await openEdit(user)
    expect(name.value).toBe("Ada")
    expect(
      screen
        .getByRole("button", { name: "Details" })
        .getAttribute("aria-pressed")
    ).toBe("false")
  })

  test("Save in the leave prompt saves, then closes", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} saveFromPrompt />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")

    // The submit shortcut is off while the prompt asks.
    await user.keyboard("{Control>}{Enter}{/Control}")
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(within(prompt).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    expect(onSubmit).toHaveBeenCalledWith({
      email: "ada@example.com",
      name: "Ada!",
    })
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })

  test("a failed Save in the leave prompt stays open and focuses the invalid field", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} saveFromPrompt />)
    const name = await openEdit(user)
    await user.clear(name)
    // Leave from another field, so focus returning there isn't a pass.
    await user.click(screen.getByLabelText(EMAIL))
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")

    await user.click(within(prompt).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(name))
  })

  test("a Save in the leave prompt that throws is announced once the prompt closes", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => {
      throw new Error("offline")
    })
    render(<Harness onSubmit={onSubmit} saveFromPrompt />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")
    const announced = watchAnnouncedAlerts()

    await user.click(within(prompt).getByRole("button", { name: "Save" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(screen.getByRole("dialog")).toBeTruthy()
    await waitFor(() =>
      expect(announced).toContain("Something went wrong. Try again.")
    )
  })

  for (const key of ["Control", "Meta"]) {
    test(`${key}+Enter submits, from a textarea too; plain Enter there doesn't`, async () => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      render(
        <Harness onSubmit={onSubmit}>
          <textarea aria-label="Notes" />
        </Harness>
      )
      const name = await openEdit(user)
      await user.type(name, "!")
      await user.type(screen.getByLabelText("Notes"), "line{Enter}")
      expect(onSubmit).not.toHaveBeenCalled()

      await user.keyboard(`{${key}>}{Enter}{/${key}}`)
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith({
          email: "ada@example.com",
          name: "Ada!",
        })
      )
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    })
  }

  test("disabled turns off Save, the shortcut and the native fields", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness disabled onSubmit={onSubmit} />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    const dialog = await screen.findByRole("dialog")
    await waitFor(() =>
      expect(dialog.contains(document.activeElement)).toBe(true)
    )
    expect(screen.getByLabelText(NAME).matches(":disabled")).toBe(true)
    expect(
      screen.getByRole("button", { name: "Save" }).matches(":disabled")
    ).toBe(true)

    await user.keyboard("{Control>}{Enter}{/Control}")
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeTruthy()
  })
})
