import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import type { ReactNode } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, RadioGroupFieldItem, useForm } from "./create-form"

afterEach(() => {
  cleanup()
})

const schema = z.object({
  email: z.email("Enter a valid email"),
  name: z.string().min(1, "Required"),
})

// Forms in these tests reuse field names (and so ids), so look controls up
// inside their own form rather than through label association.
function control(form: string, name: string) {
  return screen
    .getByRole("form", { name: form })
    .querySelector<HTMLElement>(`[name="${name}"]`)
}

function ProfileForm({
  id,
  label,
  onSubmitInvalid,
  outsideSubmit,
}: {
  id?: string
  label: string
  onSubmitInvalid?: () => void
  outsideSubmit?: boolean
}) {
  const form = useForm({
    ...(onSubmitInvalid ? { onSubmitInvalid } : {}),
    defaultValues: { email: "valid@example.com" },
    onSubmit: vi.fn(),
    schema,
  })
  const { EmailField, InputField, SubmitButton } = form
  const submit: ReactNode = (
    <SubmitButton form={id}>{`${label} submit`}</SubmitButton>
  )
  return (
    <FormProvider form={form}>
      <Form aria-label={label} id={id}>
        <EmailField name="email" />
        <InputField label="Name" name="name" />
        {outsideSubmit ? null : submit}
      </Form>
      {outsideSubmit ? submit : null}
    </FormProvider>
  )
}

describe("<Form> — focus the first invalid field on a failed submit", () => {
  test("focuses the first invalid field; onSubmitInvalid passes through", async () => {
    const user = userEvent.setup()
    const onSubmitInvalid = vi.fn()
    render(<ProfileForm label="Profile" onSubmitInvalid={onSubmitInvalid} />)
    await user.click(screen.getByRole("button", { name: "Profile submit" }))
    await waitFor(() =>
      expect(document.activeElement).toBe(control("Profile", "name"))
    )
    expect(onSubmitInvalid).toHaveBeenCalledTimes(1)
  })

  test("only the submitted form's field gets focus", async () => {
    const user = userEvent.setup()
    render(
      <>
        <ProfileForm label="Page" />
        <div role="dialog">
          <ProfileForm label="Dialog" />
        </div>
      </>
    )
    await user.click(screen.getByRole("button", { name: "Page submit" }))
    await waitFor(() =>
      expect(document.activeElement).toBe(control("Page", "name"))
    )
    // The page form is still invalid, but the dialog's submit must stay in
    // the dialog.
    await user.click(screen.getByRole("button", { name: "Dialog submit" }))
    await waitFor(() =>
      expect(document.activeElement).toBe(control("Dialog", "name"))
    )
  })

  test("works for an external <button form={id}> submit", async () => {
    const user = userEvent.setup()
    render(<ProfileForm id="profile-form" label="Profile" outsideSubmit />)
    await user.click(screen.getByRole("button", { name: "Profile submit" }))
    await waitFor(() =>
      expect(document.activeElement).toBe(control("Profile", "name"))
    )
  })

  test("a radio group or slider root hands focus to its tabbable child", async () => {
    const user = userEvent.setup()
    function Harness({ sliderFirst }: { sliderFirst: boolean }) {
      const form = useForm({
        defaultValues: { volume: 10 },
        onSubmit: vi.fn(),
        schema: z.object({
          plan: z.enum(["basic", "pro"]),
          volume: z.number().min(50),
        }),
      })
      const { RadioGroupField, SliderField, SubmitButton } = form
      const radio = (
        <RadioGroupField key="plan" label="Plan" name="plan">
          <RadioGroupFieldItem value="basic">Basic</RadioGroupFieldItem>
          <RadioGroupFieldItem value="pro">Pro</RadioGroupFieldItem>
        </RadioGroupField>
      )
      const slider = <SliderField key="volume" label="Volume" name="volume" />
      return (
        <FormProvider form={form}>
          <Form aria-label="Settings">
            {sliderFirst ? [slider, radio] : [radio, slider]}
            <SubmitButton>Save</SubmitButton>
          </Form>
        </FormProvider>
      )
    }

    const { unmount } = render(<Harness sliderFirst={false} />)
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(document.activeElement?.getAttribute("role")).toBe("radio")
    )
    unmount()

    render(<Harness sliderFirst />)
    await user.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() =>
      expect(document.activeElement?.closest('[data-field="volume"]')).not.toBe(
        null
      )
    )
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
