import { expectTypeOf, test } from "vitest"
import { useForm } from "./create-form"
import { ComboboxField } from "./fields/combobox-field"
import { MultiSelectField } from "./fields/multi-select-field"

type Party = { id: number; kind: "company" | "person" }
type PartyItem = { label: string; value: Party }

const GROUPS: { label: string; items: PartyItem[] }[] = [
  {
    items: [{ label: "Ada", value: { id: 1, kind: "person" } }],
    label: "People",
  },
]

const isSameParty = (a: Party, b: Party) => a.kind === b.kind && a.id === b.id

test("grouped items type renderItem with an item and isItemEqualToValue with its value", () => {
  ComboboxField({
    isItemEqualToValue: (a, b) => {
      expectTypeOf(a).toEqualTypeOf<Party>()
      return isSameParty(a, b)
    },
    items: GROUPS,
    renderItem: (item) => {
      expectTypeOf(item).toEqualTypeOf<PartyItem>()
      return null
    },
  })
  MultiSelectField({
    isItemEqualToValue: (a, b) => {
      expectTypeOf(a).toEqualTypeOf<Party>()
      return isSameParty(a, b)
    },
    items: GROUPS,
    renderItem: (item) => {
      expectTypeOf(item).toEqualTypeOf<PartyItem>()
      return null
    },
  })
})

// `form.ComboboxField` reads the field's props with `T` as `unknown`.
test("form fields take a comparator typed with the value", () => {
  const form = useForm({
    defaultValues: { parties: [] as Party[], payer: null as Party | null },
    onSubmit: () => undefined,
  })
  form.ComboboxField({
    isItemEqualToValue: isSameParty,
    items: GROUPS,
    name: "payer",
  })
  form.MultiSelectField({
    isItemEqualToValue: isSameParty,
    items: GROUPS,
    name: "parties",
  })
})
