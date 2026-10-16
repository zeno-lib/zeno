import { cleanup, render, screen, within } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { useState } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"

afterEach(() => {
  cleanup()
})

const party = z.object({ id: z.number(), kind: z.enum(["company", "person"]) })
type Party = z.infer<typeof party>

const schema = z.object({
  parties: z.array(party),
  payer: party.nullable(),
})
type Values = z.infer<typeof schema>

// Rebuilt on every render, as options mapped from fetched rows are, so no
// item value is ever the stored object. A person and a company share an id.
function partyGroups() {
  return [
    {
      items: [{ label: "Ada Lovelace", value: { id: 1, kind: "person" } }],
      label: "People",
    },
    {
      items: [
        { label: "Globex", value: { id: 1, kind: "company" } },
        { label: "Initech", value: { id: 2, kind: "company" } },
      ],
      label: "Companies",
    },
  ]
}

const isSameParty = (a: Party, b: Party) => a.kind === b.kind && a.id === b.id

function Harness({ captured }: { captured: { values?: Values } }) {
  const form = useForm({
    defaultValues: {
      parties: [{ id: 1, kind: "company" }],
      payer: { id: 1, kind: "company" },
    } as Values,
    onSubmit: vi.fn(),
    schema,
  })
  const { ComboboxField, MultiSelectField, Subscribe } = form
  return (
    <FormProvider form={form}>
      <Form>
        <ComboboxField
          isItemEqualToValue={isSameParty}
          items={partyGroups()}
          label="Payer"
          name="payer"
        />
        <MultiSelectField
          isItemEqualToValue={isSameParty}
          items={partyGroups()}
          label="Parties"
          name="parties"
        />
        <Subscribe selector={(state) => state.values}>
          {(values) => {
            captured.values = values
            return null
          }}
        </Subscribe>
      </Form>
    </FormProvider>
  )
}

function fieldRoot(container: HTMLElement, name: string): HTMLElement {
  const root = container.querySelector<HTMLElement>(`[data-field="${name}"]`)
  if (!root) {
    throw new Error(`no ${name} field`)
  }
  return root
}

function chips(container: HTMLElement): string[] {
  return [
    ...fieldRoot(container, "parties").querySelectorAll(
      '[data-slot="combobox-chip"]'
    ),
  ].map((chip) => chip.textContent ?? "")
}

describe("grouped options with object values", () => {
  test("ComboboxField keeps a stored object selected, stores the picked one, and clears to the empty value", async () => {
    const user = userEvent.setup()
    const captured: { values?: Values } = {}
    const { container, rerender } = render(<Harness captured={captured} />)
    const input = screen.getByRole("combobox", { name: "Payer" })
    expect(input).toHaveProperty("value", "Globex")

    await user.click(input)
    const companies = await screen.findByRole("group", { name: "Companies" })
    expect(
      within(companies)
        .getByRole("option", { name: "Globex" })
        .getAttribute("aria-selected")
    ).toBe("true")
    await user.click(screen.getByRole("option", { name: "Ada Lovelace" }))
    expect(captured.values?.payer).toEqual({ id: 1, kind: "person" })

    rerender(<Harness captured={captured} />)
    expect(input).toHaveProperty("value", "Ada Lovelace")

    await user.click(
      within(fieldRoot(container, "payer")).getByRole("button", {
        name: "Clear",
      })
    )
    expect(captured.values?.payer).toBeNull()
  })

  test("MultiSelectField keeps stored objects selected, adds the picked one, and clears", async () => {
    const user = userEvent.setup()
    const captured: { values?: Values } = {}
    const { container, rerender } = render(<Harness captured={captured} />)
    expect(chips(container)).toEqual(["Globex"])

    await user.click(screen.getByRole("combobox", { name: "Parties" }))
    const people = await screen.findByRole("group", { name: "People" })
    await user.click(
      within(people).getByRole("option", { name: "Ada Lovelace" })
    )
    await user.keyboard("{Escape}")
    expect(captured.values?.parties).toEqual([
      { id: 1, kind: "company" },
      { id: 1, kind: "person" },
    ])

    rerender(<Harness captured={captured} />)
    expect(chips(container)).toEqual(["Globex", "Ada Lovelace"])

    await user.click(
      within(fieldRoot(container, "parties")).getByRole("button", {
        name: "Clear",
      })
    )
    expect(captured.values?.parties).toEqual([])
  })
})

describe("grouped options", () => {
  test.each([
    ["a group first", [{ items: ["Ada"], label: "People" }, "Globex"]],
    ["a plain item first", ["Globex", { items: ["Ada"], label: "People" }]],
  ])("mix groups and plain items, with %s", async (_, items) => {
    const user = userEvent.setup()
    const captured: { values?: { name: string | null } } = {}
    function H() {
      const form = useForm({
        defaultValues: { name: null as string | null },
        onSubmit: vi.fn(),
      })
      return (
        <FormProvider form={form}>
          <form.ComboboxField items={items} label="Name" name="name" />
          <form.Subscribe selector={(state) => state.values}>
            {(values) => {
              captured.values = values
              return null
            }}
          </form.Subscribe>
        </FormProvider>
      )
    }
    render(<H />)
    const input = screen.getByRole("combobox", { name: "Name" })
    await user.type(input, "Ad")
    const people = await screen.findByRole("group", { name: "People" })
    await user.click(within(people).getByRole("option", { name: "Ada" }))
    expect(captured.values?.name).toBe("Ada")
    await user.clear(input)
    await user.type(input, "Glo")
    await user.click(await screen.findByRole("option", { name: "Globex" }))
    expect(captured.values?.name).toBe("Globex")
  })

  test("ComboboxField keeps what the user types while the items are rebuilt", async () => {
    const user = userEvent.setup()
    function H() {
      const [, setQuery] = useState("")
      const form = useForm({
        defaultValues: { payer: { id: 1, kind: "company" } } as Values,
        onSubmit: vi.fn(),
        schema,
      })
      return (
        <FormProvider form={form}>
          <form.ComboboxField
            isItemEqualToValue={isSameParty}
            items={partyGroups()}
            label="Payer"
            name="payer"
            onInputValueChange={setQuery}
          />
        </FormProvider>
      )
    }
    render(<H />)
    const input = screen.getByRole("combobox", { name: "Payer" })
    await user.type(input, " Corp")
    expect(input).toHaveProperty("value", "Globex Corp")
  })

  test("MultiSelectField keeps a stored value whose item isn't loaded yet", async () => {
    const user = userEvent.setup()
    const captured: { values?: Values } = {}
    function H() {
      const form = useForm({
        defaultValues: { parties: [{ id: 9, kind: "company" }] } as Values,
        onSubmit: vi.fn(),
        schema,
      })
      return (
        <FormProvider form={form}>
          <form.MultiSelectField
            isItemEqualToValue={isSameParty}
            // The companies are still loading.
            items={partyGroups().slice(0, 1)}
            label="Parties"
            name="parties"
          />
          <form.Subscribe selector={(state) => state.values}>
            {(values) => {
              captured.values = values
              return null
            }}
          </form.Subscribe>
        </FormProvider>
      )
    }
    render(<H />)
    await user.click(screen.getByRole("combobox", { name: "Parties" }))
    await user.click(
      await screen.findByRole("option", { name: "Ada Lovelace" })
    )
    expect(captured.values?.parties).toEqual([
      { id: 9, kind: "company" },
      { id: 1, kind: "person" },
    ])
  })
})
