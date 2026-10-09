import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { type ReactNode, useState } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"
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
}: {
  /** Submit through `submitAction` with this server action instead. */
  action?: (values: Values) => Promise<ActionResult<unknown>>
  children?: ReactNode
  onSubmit?: (values: Values) => unknown
  closeOnSubmit?: boolean
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
        form={form}
        title="Person"
      >
        <InputField label="Name" name="name" />
        <InputField label="Email" name="email" />
        {children}
      </FormDialog>
    </>
  )
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
})
