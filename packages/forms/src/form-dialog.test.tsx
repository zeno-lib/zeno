import {
  act,
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { type ReactNode, StrictMode, useState } from "react"
import { afterEach, describe, expect, onTestFinished, test, vi } from "vitest"
import { z } from "zod"
import { useForm } from "./create-form"
import {
  type DiscardPromptText,
  FormDialog,
  FormDialogProvider,
} from "./form-dialog"
import type { ActionResult } from "./lib/action-result"
import { submitAction } from "./lib/submit-action"
import { type FormDialogController, useFormDialog } from "./lib/use-form-dialog"

const NAME = /Name/
const EMAIL = /Email/
const INNER_NAME = /Inner name/

const animatable = HTMLElement.prototype as {
  getAnimations?: () => unknown[]
}

afterEach(() => {
  animatable.getAnimations = undefined
  cleanup()
  vi.unstubAllGlobals()
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
  controller,
  disabled,
  discardPrompt,
  formDisabled,
  saveFromPrompt,
  submitErrorMessage,
  submitLabel,
}: {
  /** Submit through `submitAction` with this server action instead. */
  action?: (values: Values) => Promise<ActionResult<unknown>>
  children?: ReactNode
  onSubmit?: (values: Values) => unknown
  closeOnSubmit?: boolean
  /** Gets the dialog's controller, to close it from outside. */
  controller?: { current?: FormDialogController<Values> }
  disabled?: boolean
  discardPrompt?: DiscardPromptText
  /** Disable the form through `useForm({ disabled })`. */
  formDisabled?: boolean
  saveFromPrompt?: boolean
  submitErrorMessage?: (error: unknown) => ReactNode
  submitLabel?: ReactNode
}) {
  const dialog = useFormDialog({ defaultValues: BLANK })
  if (controller) {
    controller.current = dialog
  }
  const form = useForm({
    defaultValues: dialog.defaultValues,
    disabled: formDisabled,
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
        discardPrompt={discardPrompt}
        form={form}
        saveFromPrompt={saveFromPrompt}
        submitErrorMessage={submitErrorMessage}
        submitLabel={submitLabel}
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

// Whether leaving the page now would make the browser ask first.
function warnsOnUnload(): boolean {
  const event = new Event("beforeunload", { cancelable: true })
  window.dispatchEvent(event)
  return event.defaultPrevented
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

  test("opens with per-session defaults under Strict Mode", async () => {
    const user = userEvent.setup()
    render(<Harness />, { wrapper: StrictMode })
    const name = await openEdit(user)
    expect(name.value).toBe("Ada")
  })

  test("an edit opened on a record with keys the schema lacks saves to a .strict() schema", async () => {
    const user = userEvent.setup()
    const strictSchema = schema.strict()
    const record = { ...ROW, createdAt: "2026-01-01", id: 7 }
    const onSubmit = vi.fn()
    function StrictHarness() {
      const dialog = useFormDialog<Values>({ defaultValues: BLANK })
      const form = useForm({
        defaultValues: dialog.defaultValues,
        onSubmit: ({ value }) => onSubmit(value),
        schema: strictSchema,
      })
      const { InputField } = form
      return (
        <>
          <button
            onClick={() => dialog.open({ defaultValues: record })}
            type="button"
          >
            Edit
          </button>
          <FormDialog dialog={dialog} form={form} title="Person">
            <InputField label="Name" name="name" />
          </FormDialog>
        </>
      )
    }
    render(<StrictHarness />)
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await screen.findByLabelText(NAME)
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(ROW))
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
    // The dialog's initial focus also lands on Name; let it settle so only
    // the failed Save can bring focus back from the Save button.
    await waitFor(() => expect(document.activeElement).toBe(name))
    await user.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Required")).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(name))
  })

  test("a save that ends after the dialog reopened leaves the new session open", async () => {
    const user = userEvent.setup()
    let finishSave: () => void = () => undefined
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve
        })
    )
    render(<Harness onSubmit={onSubmit} />)
    await openEdit(user)
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())

    await user.click(screen.getByRole("button", { name: "New" }))
    await screen.findByRole("dialog")
    await act(async () => {
      finishSave()
      await Promise.resolve()
    })
    expect(screen.getByRole("dialog")).toBeTruthy()
  })

  for (const closeOnSubmit of [true, false]) {
    test(`a leave asked for while a Save runs goes through once it saves (closeOnSubmit: ${closeOnSubmit})`, async () => {
      const user = userEvent.setup()
      let finishSave: () => void = () => undefined
      const onSubmit = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            finishSave = resolve
          })
      )
      render(<Harness closeOnSubmit={closeOnSubmit} onSubmit={onSubmit} />)
      const name = await openEdit(user)
      await user.type(name, "!")
      await user.click(screen.getByRole("button", { name: "Save" }))
      await waitFor(() => expect(onSubmit).toHaveBeenCalled())
      await user.keyboard("{Escape}")
      await screen.findByRole("alertdialog")

      finishSave()
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
      expect(screen.queryByRole("alertdialog")).toBeNull()
    })
  }

  test("an edit made while a Save runs keeps the leave prompt asking once it saves", async () => {
    const user = userEvent.setup()
    let finishSave: () => void = () => undefined
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve
        })
    )
    render(<Harness onSubmit={onSubmit} />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    await user.type(name, "?")
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")

    finishSave()
    await waitFor(() =>
      expect(screen.queryByRole("status", { hidden: true })).toBeNull()
    )
    expect(screen.getByRole("alertdialog")).toBe(prompt)
    await user.click(
      within(prompt).getByRole("button", { name: "Keep editing" })
    )
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    expect(name.value).toBe("Ada!?")
  })

  test("a Save that fails while the leave prompt asks focuses the invalid field once it closes", async () => {
    const user = userEvent.setup()
    let finishSave: (result: ActionResult<never>) => void = () => undefined
    const action = vi.fn(
      () =>
        new Promise<ActionResult<never>>((resolve) => {
          finishSave = resolve
        })
    )
    render(<Harness action={action} />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(action).toHaveBeenCalled())
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")
    await waitFor(() =>
      expect(prompt.contains(document.activeElement)).toBe(true)
    )

    finishSave({
      error: { fieldErrors: { email: ["Already taken"] }, formErrors: [] },
      ok: false,
    })
    const email = screen.getByLabelText(EMAIL)
    await waitFor(() => expect(email.getAttribute("aria-invalid")).toBe("true"))
    expect(prompt.contains(document.activeElement)).toBe(true)
    await user.click(
      within(prompt).getByRole("button", { name: "Keep editing" })
    )
    await waitFor(() => expect(document.activeElement).toBe(email))
  })

  test("closing the dialog from outside closes its leave prompt for good", async () => {
    const user = userEvent.setup()
    const controller: { current?: FormDialogController<Values> } = {}
    render(<Harness controller={controller} />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.keyboard("{Escape}")
    await screen.findByRole("alertdialog")

    act(() => controller.current?.close())
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await user.click(screen.getByRole("button", { name: "Edit" }))
    await screen.findByRole("dialog")
    expect(screen.queryByRole("alertdialog")).toBeNull()
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

  test("a Save still running when the leave prompt opens is announced once it closes", async () => {
    const user = userEvent.setup()
    let rejectSave: (error: Error) => void = () => undefined
    const onSubmit = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject
        })
    )
    render(<Harness onSubmit={onSubmit} />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")
    const announced = watchAnnouncedAlerts()

    rejectSave(new Error("offline"))
    await waitFor(() =>
      expect(document.querySelector('[data-slot="form-error"]')).not.toBeNull()
    )
    await user.click(
      within(prompt).getByRole("button", { name: "Keep editing" })
    )
    await waitFor(() =>
      expect(announced).toContain("Something went wrong. Try again.")
    )
  })

  test("a Save that fails after a discard doesn't show in the next session", async () => {
    const user = userEvent.setup()
    const report = vi.fn()
    vi.stubGlobal("reportError", report)
    let rejectSave: (error: Error) => void = () => undefined
    const onSubmit = vi.fn(
      () =>
        new Promise((_, reject) => {
          rejectSave = reject
        })
    )
    render(<Harness onSubmit={onSubmit} />)
    await user.click(screen.getByRole("button", { name: "New" }))
    await user.type(await screen.findByLabelText(NAME), "Ada")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")
    await user.click(within(prompt).getByRole("button", { name: "Discard" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    await user.click(screen.getByRole("button", { name: "New" }))
    await screen.findByRole("dialog")

    rejectSave(new Error("offline"))
    await waitFor(() => expect(report).toHaveBeenCalled())
    expect(screen.queryByRole("alert")).toBeNull()
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

  for (const via of ["disabled", "useForm({ disabled })"]) {
    test(`with ${via}, a changed dialog still asks and warns, without offering Save`, async () => {
      const user = userEvent.setup()
      const { rerender } = render(<Harness saveFromPrompt />)
      const name = await openEdit(user)
      await user.type(name, "!")

      rerender(
        <Harness
          disabled={via === "disabled"}
          formDisabled={via !== "disabled"}
          saveFromPrompt
        />
      )
      expect(warnsOnUnload()).toBe(true)
      await user.click(screen.getByRole("button", { name: "Cancel" }))
      const prompt = await screen.findByRole("alertdialog")
      expect(within(prompt).getByText("Discard changes?")).toBeTruthy()
      expect(within(prompt).queryByRole("button", { name: "Save" })).toBeNull()
      await user.click(within(prompt).getByRole("button", { name: "Discard" }))
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull())
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
    })
  }

  test("disabled while the leave prompt asks keeps it, with its Save off", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    const { rerender } = render(<Harness onSubmit={onSubmit} saveFromPrompt />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.click(screen.getByRole("button", { name: "Cancel" }))
    const prompt = await screen.findByRole("alertdialog")

    rerender(<Harness disabled onSubmit={onSubmit} saveFromPrompt />)
    await user.click(within(prompt).getByRole("button", { name: "Save" }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole("alertdialog")).toBe(prompt)
    await user.click(within(prompt).getByRole("button", { name: "Discard" }))
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })

  test("Save in the leave prompt doesn't submit again while a submit runs", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(() => new Promise(() => undefined))
    render(<Harness onSubmit={onSubmit} saveFromPrompt />)
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")
    await user.click(within(prompt).getByRole("button", { name: "Save" }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test("Ctrl+Enter during the close animation doesn't submit again", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    render(<Harness onSubmit={onSubmit} />)
    const name = await openEdit(user)
    await user.type(name, "!")
    holdExitAnimation()
    await user.keyboard("{Control>}{Enter}{/Control}")
    const dialog = screen.getByRole("dialog")
    await waitFor(() => expect(dialog.hasAttribute("data-closed")).toBe(true))
    await user.keyboard("{Control>}{Enter}{/Control}")
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  test("Ctrl+Enter in a nested dialog submits only that dialog", async () => {
    const user = userEvent.setup()
    const outer = vi.fn()
    const inner = vi.fn()
    function Inner() {
      const dialog = useFormDialog({ defaultValues: ROW })
      const form = useForm({
        defaultValues: dialog.defaultValues,
        onSubmit: ({ value }) => inner(value),
        schema,
      })
      return (
        <FormDialog
          dialog={dialog}
          form={form}
          title="Inner"
          trigger={<button type="button">Open inner</button>}
        >
          <form.InputField label="Inner name" name="name" />
        </FormDialog>
      )
    }
    render(
      <Harness onSubmit={outer}>
        <Inner />
      </Harness>
    )
    await openEdit(user)
    await user.click(screen.getByRole("button", { name: "Open inner" }))
    const innerName = await screen.findByLabelText(INNER_NAME)
    await user.type(innerName, "!")
    await user.keyboard("{Control>}{Enter}{/Control}")
    await waitFor(() => expect(inner).toHaveBeenCalled())
    expect(outer).not.toHaveBeenCalled()
  })
})

describe("FormDialogProvider", () => {
  test("sets the defaults of the dialogs below it; a dialog's own prop wins", async () => {
    const user = userEvent.setup()
    render(
      <FormDialogProvider
        cancelLabel="Abbrechen"
        discardPrompt={{
          confirmLabel: "Verwerfen",
          saveLabel: "Sichern",
          saveTitle: "Speichern?",
          title: "Verwerfen?",
        }}
      >
        <FormDialogProvider saveFromPrompt submitLabel="Speichern">
          <Harness discardPrompt={{ title: "Leave this person?" }} />
        </FormDialogProvider>
      </FormDialogProvider>
    )
    const name = await openEdit(user)
    const dialog = screen.getByRole("dialog")
    within(dialog).getByRole("button", { name: "Speichern" })
    await user.type(name, "!")
    await user.click(within(dialog).getByRole("button", { name: "Abbrechen" }))

    // The prompt's copy merges key by key, and the nearest level wins: the
    // dialog's title over the outer provider's `saveTitle`, its Discard
    // label, and Save labelled by the inner provider's `submitLabel` over the
    // outer one's `saveLabel`.
    const prompt = await screen.findByRole("alertdialog")
    within(prompt).getByText("Leave this person?")
    within(prompt).getByRole("button", { name: "Verwerfen" })
    within(prompt).getByRole("button", { name: "Speichern" })
  })

  test.each([
    [true, "Unsaved changes", "Save them before you leave?"],
    [false, "Discard changes?", "They will be lost."],
  ])(
    "a provider words the prompt for each mode (saveFromPrompt: %s)",
    async (saveFromPrompt, title, description) => {
      const user = userEvent.setup()
      render(
        <FormDialogProvider
          discardPrompt={{
            description: "They will be lost.",
            saveDescription: "Save them before you leave?",
            saveTitle: "Unsaved changes",
            title: "Discard changes?",
          }}
        >
          <Harness saveFromPrompt={saveFromPrompt} />
        </FormDialogProvider>
      )
      const name = await openEdit(user)
      await user.type(name, "!")
      await user.keyboard("{Escape}")
      const prompt = await screen.findByRole("alertdialog")
      within(prompt).getByText(title)
      within(prompt).getByText(description)
    }
  )

  test("a dialog's submitLabel labels the prompt's Save over a provider's saveLabel", async () => {
    const user = userEvent.setup()
    render(
      <FormDialogProvider discardPrompt={{ saveLabel: "Speichern" }}>
        <Harness saveFromPrompt submitLabel="Create invoice" />
      </FormDialogProvider>
    )
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")
    within(prompt).getByRole("button", { name: "Create invoice" })
  })

  test("a dialog's own false wins over the provider's true", async () => {
    const user = userEvent.setup()
    render(
      <FormDialogProvider saveFromPrompt>
        <Harness saveFromPrompt={false} />
      </FormDialogProvider>
    )
    const name = await openEdit(user)
    await user.type(name, "!")
    await user.keyboard("{Escape}")
    const prompt = await screen.findByRole("alertdialog")
    expect(within(prompt).queryByRole("button", { name: "Save" })).toBeNull()
  })
})
