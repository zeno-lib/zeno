import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"

const PROFILE_NAME = /Profile name/
const PROFILE_EMAIL = /Profile email/

afterEach(() => {
  cleanup()
})

// Both forms reuse the same field names (and so the same ids), so look inputs
// up inside their own form rather than through label association.
function nameInput(form: string) {
  return screen
    .getByRole("form", { name: form })
    .querySelector<HTMLInputElement>('input[name="name"]')
}

const schema = z.object({
  email: z.email("Enter a valid email"),
  name: z.string().min(1, "Required"),
})

function ProfileForm({
  focusOnSubmitInvalid,
  label,
  onSubmitInvalid,
}: {
  focusOnSubmitInvalid?: boolean
  label: string
  onSubmitInvalid?: () => void
}) {
  const form = useForm({
    ...(focusOnSubmitInvalid === undefined ? {} : { focusOnSubmitInvalid }),
    ...(onSubmitInvalid ? { onSubmitInvalid } : {}),
    defaultValues: { email: "valid@example.com" },
    onSubmit: vi.fn(),
    schema,
    validators: "submit",
  })
  const { EmailField, InputField, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Form aria-label={label}>
        <EmailField label={`${label} email`} name="email" />
        <InputField label={`${label} name`} name="name" />
        <SubmitButton>{`${label} submit`}</SubmitButton>
      </Form>
    </FormProvider>
  )
}

describe("useForm — focus on submit invalid", () => {
  test("focuses the first aria-invalid control by default", async () => {
    const user = userEvent.setup()
    render(<ProfileForm label="Profile" />)
    await user.click(screen.getByRole("button", { name: "Profile submit" }))
    const name = screen.getByLabelText(PROFILE_NAME)
    await waitFor(() => expect(document.activeElement).toBe(name))
    expect(name?.getAttribute("aria-invalid")).toBe("true")
    expect(
      screen.getByLabelText(PROFILE_EMAIL).hasAttribute("aria-invalid")
    ).toBe(false)
  })

  test("stays scoped to the submitted form's own DOM node", async () => {
    const user = userEvent.setup()
    render(
      <>
        <ProfileForm label="Page" />
        <div role="dialog">
          <ProfileForm label="Dialog" />
        </div>
      </>
    )
    // Make the page form invalid first, then move focus away from it.
    await user.click(screen.getByRole("button", { name: "Page submit" }))
    await waitFor(() => expect(document.activeElement).toBe(nameInput("Page")))

    await user.click(screen.getByRole("button", { name: "Dialog submit" }))
    await waitFor(() =>
      expect(document.activeElement).toBe(nameInput("Dialog"))
    )
  })

  test("user onSubmitInvalid is still called", async () => {
    const user = userEvent.setup()
    const onSubmitInvalid = vi.fn()
    render(<ProfileForm label="Profile" onSubmitInvalid={onSubmitInvalid} />)
    await user.click(screen.getByRole("button", { name: "Profile submit" }))
    await waitFor(() => expect(onSubmitInvalid).toHaveBeenCalledTimes(1))
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText(PROFILE_NAME))
    )
  })

  test("focusOnSubmitInvalid: false opts out", async () => {
    const user = userEvent.setup()
    const onSubmitInvalid = vi.fn()
    render(
      <ProfileForm
        focusOnSubmitInvalid={false}
        label="Profile"
        onSubmitInvalid={onSubmitInvalid}
      />
    )
    const submit = screen.getByRole("button", { name: "Profile submit" })
    await user.click(submit)
    await waitFor(() => expect(onSubmitInvalid).toHaveBeenCalledTimes(1))
    const name = screen.getByLabelText(PROFILE_NAME)
    await waitFor(() => expect(name?.getAttribute("aria-invalid")).toBe("true"))
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(document.activeElement).not.toBe(name)
  })
})

describe("fields — data-field and array rows", () => {
  test("every Field root carries data-field={name}; array rows get the required indicator", () => {
    const rowsSchema = z.object({
      email: z.email(),
      members: z.array(
        z.object({
          name: z.string().min(1),
          note: z.string().optional(),
        })
      ),
    })
    function Harness() {
      const form = useForm({
        defaultValues: { members: [{ name: "" }, { name: "" }] },
        onSubmit: vi.fn(),
        schema: rowsSchema,
      })
      const { EmailField, InputField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <EmailField label="Email" name="email" />
            <InputField label="Row 1 name" name="members[0].name" />
            <InputField label="Row 2 name" name="members[1].name" />
            <InputField label="Row 2 note" name="members[1].note" />
          </Form>
        </FormProvider>
      )
    }
    const { container } = render(<Harness />)
    for (const name of [
      "email",
      "members[0].name",
      "members[1].name",
      "members[1].note",
    ]) {
      const root = container.querySelector(`[data-field="${name}"]`)
      expect(root).not.toBeNull()
      expect(root?.getAttribute("data-slot")).toBe("field")
    }
    const indicator = (label: string) =>
      screen.getByText(label).querySelector('[data-slot="required-indicator"]')
    expect(indicator("Row 1 name")).not.toBeNull()
    expect(indicator("Row 2 name")).not.toBeNull()
    expect(indicator("Row 2 note")).toBeNull()
  })
})
