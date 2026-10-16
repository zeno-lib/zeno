import { test } from "vitest"
import { createZenoForm } from "./create-zeno-form"
import { FormError } from "./fields/form-error"
import { MoneyField } from "./fields/money-field"
import { PercentageField } from "./fields/percentage-field"
import { SelectField } from "./fields/select-field"
import { FormDialogProvider } from "./form-dialog"

const fieldComponents = { MoneyField, PercentageField, SelectField }
const formComponents = { FormError }

test("defaultProps takes each component's own props", () => {
  createZenoForm({
    defaultProps: {
      FormError: { submitErrorMessage: "Try again later." },
      MoneyField: { currency: "CHF", locale: "de-CH" },
      PercentageField: { scale: "fraction" },
    },
    fieldComponents,
    formComponents,
  })
})

test("defaultProps rejects another component's prop", () => {
  createZenoForm({
    defaultProps: {
      // @ts-expect-error — `scale` is PercentageField's
      MoneyField: { scale: "fraction" },
    },
    fieldComponents,
    formComponents,
  })
})

test("defaultProps rejects a required prop, which every call site still passes", () => {
  createZenoForm({
    defaultProps: {
      // @ts-expect-error — `children` is required
      SelectField: { children: null },
    },
    fieldComponents,
    formComponents,
  })
})

test("defaultProps rejects a component the form doesn't have", () => {
  createZenoForm({
    defaultProps: {
      // @ts-expect-error — no such component
      YearField: { min: 1900 },
    },
    fieldComponents,
    formComponents,
  })
})

test("FormDialogProvider takes the options every dialog shares", () => {
  FormDialogProvider({
    children: null,
    discardPrompt: { title: "Leave?" },
    saveFromPrompt: true,
    submitLabel: "Speichern",
  })
  // @ts-expect-error — a title belongs to one dialog
  FormDialogProvider({ children: null, title: "Person" })
})
