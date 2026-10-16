import {
  cleanup,
  render,
  screen,
  waitFor,
} from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { memo, type ReactNode, useState } from "react"
import { createPortal } from "react-dom"
import { afterEach, describe, expect, test, vi } from "vitest"
import { Form, FormProvider, RadioGroupFieldItem, useForm } from "./create-form"
import { FormDialog } from "./form-dialog"
import { useFormDialog } from "./lib/use-form-dialog"

afterEach(() => {
  cleanup()
})

type Values = { accept: boolean; name: string; notify: boolean; plan: string }
const DEFAULTS: Values = {
  accept: false,
  name: "",
  notify: false,
  plan: "free",
}

type Box = { current: Values | undefined }

// The fields that draw their own controls, which a `<fieldset disabled>`
// doesn't reach, plus a native input. `notify` passes `disabled={false}`.
function renderFields(form: ReturnType<typeof useTestForm>) {
  const { CheckboxField, InputField, RadioGroupField, SwitchField } = form
  return (
    <>
      <CheckboxField label="Accept" name="accept" />
      <SwitchField disabled={false} label="Notify" name="notify" />
      <RadioGroupField label="Plan" name="plan">
        <RadioGroupFieldItem value="free">Free</RadioGroupFieldItem>
        <RadioGroupFieldItem value="pro">Pro</RadioGroupFieldItem>
      </RadioGroupField>
      <InputField label="Name" name="name" />
    </>
  )
}

function useTestForm(options: { disabled?: boolean; onSubmit?: () => void }) {
  return useForm({
    defaultValues: DEFAULTS,
    disabled: options.disabled,
    onSubmit: options.onSubmit ?? vi.fn(),
  })
}

function Capture({
  captured,
  form,
}: {
  captured: Box
  form: ReturnType<typeof useTestForm>
}) {
  const { Subscribe } = form
  return (
    <Subscribe selector={(state) => state.values}>
      {(values) => {
        captured.current = values
        return null
      }}
    </Subscribe>
  )
}

const DRAWN_CONTROLS = [
  ["checkbox", "Accept"],
  ["switch", "Notify"],
  ["radio", "Pro"],
] as const

// Clicks each control the fields draw, then checks that none took the click
// and that each shows as disabled. They are spans over a hidden input: a
// `<fieldset disabled>` disables only the input, so the span still looks,
// focuses and announces as enabled.
async function expectDrawnControlsDisabled(
  user: ReturnType<typeof userEvent.setup>,
  captured: Box
) {
  const [checkbox, toggle, radio] = DRAWN_CONTROLS.map(([role, name]) =>
    screen.getByRole(role, { name })
  ) as [HTMLElement, HTMLElement, HTMLElement]
  await user.click(checkbox)
  await user.click(toggle)
  await user.click(radio)
  expect(captured.current).toEqual(DEFAULTS)
  for (const [role, name] of DRAWN_CONTROLS) {
    expect(screen.getByRole(role, { name }).hasAttribute("data-disabled")).toBe(
      true
    )
  }
}

describe("a disabled form", () => {
  test.each(["useForm({ disabled })", "<Form disabled>"])(
    "%s turns off every field, a field's `disabled={false}` included, and the submit",
    async (via) => {
      const user = userEvent.setup()
      const onSubmit = vi.fn()
      const captured: Box = { current: undefined }
      function H() {
        const form = useTestForm({
          disabled: via.startsWith("useForm"),
          onSubmit,
        })
        const { SubmitButton } = form
        return (
          <FormProvider form={form}>
            <Form disabled={via.startsWith("<Form")} id="profile">
              {renderFields(form)}
              <SubmitButton>Save</SubmitButton>
              <Capture captured={captured} form={form} />
            </Form>
            <button form="profile" type="submit">
              Save from outside
            </button>
          </FormProvider>
        )
      }
      render(<H />)
      await expectDrawnControlsDisabled(user, captured)
      expect(
        screen.getByRole("textbox", { name: "Name" }).matches(":disabled")
      ).toBe(true)
      expect(
        screen.getByRole("button", { name: "Save" }).matches(":disabled")
      ).toBe(true)
      await user.click(
        screen.getByRole("button", { name: "Save from outside" })
      )
      expect(onSubmit).not.toHaveBeenCalled()
    }
  )

  test("a field's own `disabled` still applies in an enabled form", async () => {
    const user = userEvent.setup()
    const captured: Box = { current: undefined }
    function H() {
      const form = useTestForm({})
      const { CheckboxField, SwitchField } = form
      return (
        <FormProvider form={form}>
          <Form>
            <CheckboxField label="Accept" name="accept" />
            <SwitchField disabled label="Notify" name="notify" />
            <Capture captured={captured} form={form} />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.click(screen.getByRole("checkbox", { name: "Accept" }))
    await user.click(screen.getByRole("switch", { name: "Notify" }))
    expect(captured.current).toEqual({ ...DEFAULTS, accept: true })
  })

  test("toggling `useForm({ disabled })` reaches fields under a memoized parent", async () => {
    const user = userEvent.setup()
    const captured: Box = { current: undefined }
    const Section = memo(({ form }: { form: ReturnType<typeof useTestForm> }) =>
      renderFields(form)
    )
    function H() {
      const [locked, setLocked] = useState(false)
      const form = useTestForm({ disabled: locked })
      return (
        <FormProvider form={form}>
          <button onClick={() => setLocked(true)} type="button">
            Lock
          </button>
          <Form>
            <Section form={form} />
            <Capture captured={captured} form={form} />
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    await user.click(screen.getByRole("button", { name: "Lock" }))
    await expectDrawnControlsDisabled(user, captured)
  })

  test("toggling `useForm({ disabled })` reaches memoized fields with no Zeno provider", async () => {
    const user = userEvent.setup()
    const captured: Box = { current: undefined }
    const Section = memo(({ form }: { form: ReturnType<typeof useTestForm> }) =>
      renderFields(form)
    )
    function H() {
      const [locked, setLocked] = useState(false)
      const form = useTestForm({ disabled: locked })
      return (
        <form.AppForm>
          <button onClick={() => setLocked(true)} type="button">
            Lock
          </button>
          <Section form={form} />
          <Capture captured={captured} form={form} />
        </form.AppForm>
      )
    }
    render(<H />)
    await user.click(screen.getByRole("button", { name: "Lock" }))
    await expectDrawnControlsDisabled(user, captured)
  })

  test("a form rendered inside another's `<Form disabled>` keeps its own state", async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn()
    function H() {
      const outer = useTestForm({})
      const inner = useForm({ defaultValues: { title: "" }, onSubmit })
      return (
        <FormProvider form={outer}>
          <Form disabled>
            <outer.InputField label="Name" name="name" />
            {/* A quick-add popover: portalled, under TanStack's provider. */}
            {createPortal(
              <inner.AppForm>
                <Form>
                  <inner.InputField label="Title" name="title" />
                  <inner.SubmitButton>Add</inner.SubmitButton>
                </Form>
              </inner.AppForm>,
              document.body
            )}
          </Form>
        </FormProvider>
      )
    }
    render(<H />)
    expect(
      screen.getByRole("textbox", { name: "Name" }).matches(":disabled")
    ).toBe(true)
    await user.type(screen.getByRole("textbox", { name: "Title" }), "Draft")
    await user.click(screen.getByRole("button", { name: "Add" }))
    expect(onSubmit).toHaveBeenCalledOnce()
  })

  test("CheckboxGroupField dims each option's label", () => {
    function H() {
      const form = useForm({
        defaultValues: { channels: [] as string[] },
        disabled: true,
      })
      return (
        <FormProvider form={form}>
          <form.CheckboxGroupField
            items={[{ label: "Email", value: "email" }]}
            label="Channels"
            name="channels"
          />
        </FormProvider>
      )
    }
    render(<H />)
    const option = screen.getByRole("checkbox", { name: "Email" })
    expect(
      option.closest('[data-slot="field"]')?.getAttribute("data-disabled")
    ).toBe("true")
  })
})

describe("FormDialog", () => {
  function DialogHarness({
    captured,
    children,
    disabled,
    formDisabled,
  }: {
    captured: Box
    children?: ReactNode
    disabled?: boolean
    formDisabled?: boolean
  }) {
    const dialog = useFormDialog({ defaultValues: DEFAULTS })
    const form = useForm({
      defaultValues: dialog.defaultValues,
      disabled: formDisabled,
      onSubmit: vi.fn(),
    })
    return (
      <>
        <button onClick={() => dialog.open()} type="button">
          Open
        </button>
        <FormDialog
          dialog={dialog}
          disabled={disabled}
          form={form}
          title="Profile"
        >
          {renderFields(form)}
          <Capture captured={captured} form={form} />
          {children}
        </FormDialog>
      </>
    )
  }

  test("disabled reaches the checkbox, switch and radio its fieldset can't", async () => {
    const user = userEvent.setup()
    const captured: Box = { current: undefined }
    render(<DialogHarness captured={captured} disabled />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await screen.findByRole("dialog")
    await expectDrawnControlsDisabled(user, captured)
  })

  test("`useForm({ disabled })` turns off Save, as the prop does", async () => {
    const user = userEvent.setup()
    const captured: Box = { current: undefined }
    render(<DialogHarness captured={captured} formDisabled />)
    await user.click(screen.getByRole("button", { name: "Open" }))
    await screen.findByRole("dialog")
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Save" }).matches(":disabled")
      ).toBe(true)
    )
    await expectDrawnControlsDisabled(user, captured)
  })
})
