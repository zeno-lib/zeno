import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, describe, expect, test, vi } from "vitest"
import { createZenoForm } from "./create-zeno-form"
import { FormError } from "./fields/form-error"
import { InputField } from "./fields/input-field"
import { MoneyField } from "./fields/money-field"
import { SubmitButton } from "./fields/submit-button"
import { FormDialog } from "./form-dialog"
import { Form, FormProvider } from "./form-element"
import { useFormDialog } from "./lib/use-form-dialog"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const { useForm } = createZenoForm({
  defaultProps: {
    FormError: { submitErrorMessage: "Not saved. Try again later." },
    MoneyField: { currency: "CHF", currencyDisplay: "code", placeholder: "0" },
  },
  fieldComponents: { InputField, MoneyField },
  formComponents: { FormError, SubmitButton },
})

const VALUES = {
  amount: null as number | null,
  fee: null as number | null,
  name: "",
  total: null as number | null,
}

function Harness({ onSubmit = vi.fn() }: { onSubmit?: () => unknown }) {
  const form = useForm({ defaultValues: VALUES, onSubmit })
  const unset: string | undefined = undefined
  return (
    <FormProvider form={form}>
      <Form>
        <form.MoneyField label="Amount" name="amount" />
        <form.MoneyField currency="EUR" label="Fee" name="fee" />
        <form.MoneyField currency={unset} label="Total" name="total" />
        <form.InputField label="Name" name="name" />
        <form.FormError />
        <form.SubmitButton>Submit</form.SubmitButton>
      </Form>
    </FormProvider>
  )
}

function addonOf(label: string) {
  return screen
    .getByLabelText(label)
    .closest("[data-slot=input-group]")
    ?.querySelector("[data-slot=input-group-addon]")?.textContent
}

describe("createZenoForm({ defaultProps })", () => {
  test("a field renders with its defaults, and a prop passed at the call site wins", () => {
    render(<Harness />)
    expect(addonOf("Amount")).toBe("CHF")
    expect(addonOf("Fee")).toBe("EUR")
  })

  test("a prop passed as undefined keeps the default", () => {
    render(<Harness />)
    expect(addonOf("Total")).toBe("CHF")
  })

  test("a component with no defaults renders as before", () => {
    render(<Harness />)
    expect(screen.getByLabelText("Amount").getAttribute("placeholder")).toBe(
      "0"
    )
    // InputField shares MoneyField's props, but not its defaults.
    expect(screen.getByLabelText("Name").hasAttribute("placeholder")).toBe(
      false
    )
  })

  test("a form component renders with its defaults", async () => {
    vi.stubGlobal("reportError", vi.fn())
    const user = userEvent.setup()
    render(
      <Harness
        onSubmit={() => {
          throw new Error("offline")
        }}
      />
    )
    await user.click(screen.getByRole("button", { name: "Submit" }))
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Not saved. Try again later."
    )
  })

  test("a FormDialog renders the form's FormError, with its defaults", async () => {
    vi.stubGlobal("reportError", vi.fn())
    const user = userEvent.setup()
    function DialogHarness() {
      const dialog = useFormDialog({ defaultValues: VALUES })
      const form = useForm({
        defaultValues: dialog.defaultValues,
        onSubmit: () => {
          throw new Error("offline")
        },
      })
      return (
        <>
          <button onClick={() => dialog.open()} type="button">
            New
          </button>
          <FormDialog dialog={dialog} form={form} title="Payment">
            <form.InputField label="Name" name="name" />
          </FormDialog>
        </>
      )
    }
    render(<DialogHarness />)
    await user.click(screen.getByRole("button", { name: "New" }))
    await user.click(await screen.findByRole("button", { name: "Save" }))
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Not saved. Try again later."
    )
  })

  test("a component with defaults keeps its statics", () => {
    function Hint({ text = "None" }: { text?: string }) {
      return <p>{text}</p>
    }
    Hint.Icon = () => <span>i</span>
    const { useForm: useHintForm } = createZenoForm({
      defaultProps: { Hint: { text: "Marked fields are required" } },
      fieldComponents: { InputField },
      formComponents: { Hint },
    })
    function HintHarness() {
      const form = useHintForm({ defaultValues: {}, onSubmit: vi.fn() })
      return (
        <FormProvider form={form}>
          <form.Hint />
          <form.Hint.Icon />
        </FormProvider>
      )
    }
    render(<HintHarness />)
    screen.getByText("Marked fields are required")
    screen.getByText("i")
  })

  test("a field rendered through AppField gets its defaults too", () => {
    function AppFieldHarness() {
      const form = useForm({ defaultValues: VALUES, onSubmit: vi.fn() })
      return (
        <FormProvider form={form}>
          <form.AppField name="amount">
            {(field) => <field.MoneyField label="Amount" />}
          </form.AppField>
        </FormProvider>
      )
    }
    render(<AppFieldHarness />)
    expect(addonOf("Amount")).toBe("CHF")
  })
})
