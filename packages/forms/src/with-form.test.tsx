import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { afterEach, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm, withForm } from "./create-form"

const CITY = /City/

afterEach(() => {
  cleanup()
})

const schema = z.object({
  address: z.object({ city: z.string().min(1, "Enter a city") }),
  name: z.string(),
})
type Profile = z.infer<typeof schema>

const AddressSection = withForm({
  defaultValues: {} as Profile,
  render: ({ form }) => <form.InputField label="City" name="address.city" />,
})

test("a withForm section edits and validates the parent's form", async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  function Profile() {
    const form = useForm({ onSubmit: ({ value }) => onSubmit(value), schema })
    const { SubmitButton } = form
    return (
      <FormProvider form={form}>
        <Form>
          <AddressSection form={form} />
          <SubmitButton>Save</SubmitButton>
        </Form>
      </FormProvider>
    )
  }
  render(<Profile />)

  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(await screen.findByText("Enter a city")).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByLabelText(CITY))

  await user.type(screen.getByLabelText(CITY), "Basel")
  await user.click(screen.getByRole("button", { name: "Save" }))
  expect(onSubmit).toHaveBeenCalledWith({
    address: { city: "Basel" },
    name: "",
  })
})
