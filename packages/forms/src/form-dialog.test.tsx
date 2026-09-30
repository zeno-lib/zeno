import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { useForm } from "./create-form"
import { FormDialog } from "./form-dialog"
import { useFormDialog } from "./lib/use-form-dialog"

const NAME = /Name/
const EMAIL = /Email/

afterEach(() => {
  cleanup()
})

const schema = z.object({
  email: z.string(),
  name: z.string().min(1, "Required"),
})
type Values = z.infer<typeof schema>
const BLANK: Values = { email: "", name: "" }
const ROW: Values = { email: "ada@example.com", name: "Ada" }

function Harness({
  onSubmit = vi.fn(),
  closeOnSubmit,
}: {
  onSubmit?: (values: Values) => unknown
  closeOnSubmit?: boolean
}) {
  const dialog = useFormDialog({ defaultValues: BLANK })
  const form = useForm({
    defaultValues: dialog.defaultValues,
    onSubmit: ({ value }) => onSubmit(value),
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
})
