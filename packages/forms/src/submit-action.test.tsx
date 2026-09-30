import { cleanup, render, screen } from "@zeno-lib/test/testing-library"
import userEvent from "@zeno-lib/test/user-event"
import { useState } from "react"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { Form, FormProvider, useForm } from "./create-form"
import type { ActionResult } from "./lib/action-result"
import { submitAction } from "./lib/submit-action"
import { ValidationError } from "./lib/validation-error"
import type { ValidationMode } from "./lib/validation-modes"

afterEach(() => {
  cleanup()
})

const SUBMIT = { name: "Submit" }
const EMAIL_LABEL = /Email/
const NAME_LABEL = /Name/

function failure(
  fieldErrors: Record<string, string[]>,
  formErrors: string[] = []
): ActionResult<never> {
  return { error: { fieldErrors, formErrors }, ok: false }
}

const profileSchema = z.object({
  email: z.email("Enter a valid email"),
  name: z.string().min(1, "Required"),
})
type Profile = z.infer<typeof profileSchema>

function ProfileForm({
  action,
  formRef,
  validators,
}: {
  action: (input: Profile) => Promise<ActionResult<unknown>>
  formRef?: { current: unknown }
  validators?: ValidationMode
}) {
  const form = useForm({
    defaultValues: { email: "ada@example.com", name: "Ada" },
    onSubmit: (submit) => submitAction(submit, action),
    schema: profileSchema,
    ...(validators ? { validators } : {}),
  })
  if (formRef) {
    formRef.current = form
  }
  const { EmailField, InputField, SubmitButton } = form
  return (
    <FormProvider form={form}>
      <Form>
        <InputField label="Name" name="name" />
        <EmailField label="Email" name="email" />
        <SubmitButton>Submit</SubmitButton>
      </Form>
    </FormProvider>
  )
}

describe("submitAction — field errors from the action", () => {
  const modes: ValidationMode[] = [
    "blur-then-change",
    "change",
    "blur",
    "submit",
  ]

  for (const mode of modes) {
    test(`${mode}: an error lands on its field and clears when that field is edited, not another`, async () => {
      const user = userEvent.setup()
      const action = vi.fn(() =>
        Promise.resolve(
          failure({ email: ["Already taken"], name: ["Name is reserved"] })
        )
      )
      render(<ProfileForm action={action} validators={mode} />)

      await user.click(screen.getByRole("button", SUBMIT))

      expect(await screen.findByText("Already taken")).not.toBeNull()
      expect(screen.getByText("Name is reserved")).not.toBeNull()

      // Editing the email clears only the email's server message.
      await user.type(screen.getByLabelText(EMAIL_LABEL), "m")
      expect(screen.queryByText("Already taken")).toBeNull()
      expect(screen.getByText("Name is reserved")).not.toBeNull()

      await user.type(screen.getByLabelText(NAME_LABEL), "x")
      expect(screen.queryByText("Name is reserved")).toBeNull()
    })
  }

  test("a field with a server error blocks resubmission until it is edited", async () => {
    const user = userEvent.setup()
    const action = vi
      .fn<(input: Profile) => Promise<ActionResult<unknown>>>()
      .mockResolvedValueOnce(failure({ email: ["Already taken"] }))
      .mockResolvedValue({ data: null, ok: true })
    render(<ProfileForm action={action} />)

    await user.click(screen.getByRole("button", SUBMIT))
    await screen.findByText("Already taken")
    await user.click(screen.getByRole("button", SUBMIT))
    expect(action).toHaveBeenCalledTimes(1)

    await user.type(screen.getByLabelText(EMAIL_LABEL), "m")
    await user.click(screen.getByRole("button", SUBMIT))
    expect(action).toHaveBeenCalledTimes(2)
  })

  test("array-index paths reach the field registered under that name", async () => {
    const user = userEvent.setup()
    const schema = z.object({
      owners: z.array(z.object({ name: z.string(), percentage: z.string() })),
    })
    function Harness() {
      const form = useForm({
        defaultValues: {
          owners: [
            { name: "Ada", percentage: "60" },
            { name: "Grace", percentage: "40" },
          ],
        },
        onSubmit: (submit) =>
          submitAction(submit, () =>
            Promise.resolve(
              failure({
                "owners[1].percentage": ["Exceeds the remaining share"],
              })
            )
          ),
        schema,
      })
      const { InputField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Owner 1 share" name="owners[0].percentage" />
            <InputField label="Owner 2 share" name="owners[1].percentage" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole("button", SUBMIT))

    const message = await screen.findByText("Exceeds the remaining share")
    const second = screen.getByLabelText("Owner 2 share")
    expect(second.getAttribute("aria-invalid")).toBe("true")
    expect(
      screen.getByLabelText("Owner 1 share").getAttribute("aria-invalid")
    ).not.toBe("true")
    expect(message).not.toBeNull()
  })

  test("form errors and messages for unmounted names become the form-level error", async () => {
    const user = userEvent.setup()
    const formRef: { current: unknown } = { current: undefined }
    const action = () =>
      Promise.resolve(
        failure({ "owners[3].name": ["Unknown owner"] }, ["Record is locked"])
      )
    render(<ProfileForm action={action} formRef={formRef} />)

    await user.click(screen.getByRole("button", SUBMIT))

    await vi.waitFor(() => {
      const form = formRef.current as { state: { errorMap: unknown } }
      expect(form.state.errorMap).toMatchObject({
        onSubmit: "Record is locked\nUnknown owner",
      })
    })
    const form = formRef.current as {
      state: { fieldMeta: Record<string, unknown> }
    }
    expect(form.state.fieldMeta["owners[3].name"]).toBeUndefined()
  })

  test("a ValidationError thrown from onSubmit also clears when its field is edited", async () => {
    const user = userEvent.setup()
    function Harness() {
      const form = useForm({
        defaultValues: { email: "ada@example.com", name: "Ada" },
        onSubmit: () => {
          throw new ValidationError({ email: "Taken on the server" })
        },
        schema: profileSchema,
      })
      const { EmailField, InputField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
            <EmailField label="Email" name="email" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole("button", SUBMIT))
    expect(await screen.findByText("Taken on the server")).not.toBeNull()

    await user.type(screen.getByLabelText(NAME_LABEL), "x")
    expect(screen.getByText("Taken on the server")).not.toBeNull()

    await user.type(screen.getByLabelText(EMAIL_LABEL), "m")
    expect(screen.queryByText("Taken on the server")).toBeNull()
  })

  test("several messages for one field all render", async () => {
    const user = userEvent.setup()
    const action = () =>
      Promise.resolve(
        failure({ email: ["Already taken", "Domain is blocked"] })
      )
    render(<ProfileForm action={action} />)

    await user.click(screen.getByRole("button", SUBMIT))

    expect(await screen.findByText("Already taken")).not.toBeNull()
    expect(screen.getByText("Domain is blocked")).not.toBeNull()
  })

  test("a thrown action error propagates and applies nothing", async () => {
    const boom = new Error("network down")
    const run = submitAction(
      {
        formApi: {} as never,
        value: { email: "a@b.co", name: "A" },
      },
      () => Promise.reject(boom)
    )
    await expect(run).rejects.toBe(boom)
  })
})

describe("submitAction — schema", () => {
  test("passes the schema output to the action, not the input values", async () => {
    const user = userEvent.setup()
    const schema = z.object({
      percentage: z.string().transform((value) => Number(value)),
    })
    const action = vi.fn((input: { percentage: number }) =>
      Promise.resolve<ActionResult<number>>({
        data: input.percentage,
        ok: true,
      })
    )
    function Harness() {
      const form = useForm({
        defaultValues: { percentage: "42" },
        onSubmit: (submit) => submitAction(submit, action, { schema }),
      })
      const { InputField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Share" name="percentage" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole("button", SUBMIT))

    await vi.waitFor(() =>
      expect(action).toHaveBeenCalledWith({ percentage: 42 })
    )
  })

  test("a client-side schema failure is applied and the action is not called", async () => {
    const user = userEvent.setup()
    const schema = z.object({ name: z.string().min(3, "At least 3") })
    const action = vi.fn(() =>
      Promise.resolve<ActionResult<null>>({ data: null, ok: true })
    )
    let result: ActionResult<null> | undefined
    function Harness() {
      const form = useForm({
        defaultValues: { name: "Al" },
        onSubmit: async (submit) => {
          result = await submitAction(submit, action, { schema })
        },
      })
      const { InputField, SubmitButton } = form
      return (
        <FormProvider form={form}>
          <Form>
            <InputField label="Name" name="name" />
            <SubmitButton>Submit</SubmitButton>
          </Form>
        </FormProvider>
      )
    }
    render(<Harness />)

    await user.click(screen.getByRole("button", SUBMIT))

    expect(await screen.findByText("At least 3")).not.toBeNull()
    expect(action).not.toHaveBeenCalled()
    expect(result).toEqual({
      error: { fieldErrors: { name: ["At least 3"] }, formErrors: [] },
      ok: false,
    })
  })
})

describe("submitAction — success", () => {
  type FormState = {
    state: {
      isDefaultValue: boolean
      isDirty: boolean
      values: Profile
    }
  }

  // The page re-reading the saved record, as `revalidatePath` does for a
  // server component: `defaultValues` follows what the action saved.
  function SavedForm({
    formRef,
    reset,
  }: {
    formRef: { current: unknown }
    reset?: "values" | true
  }) {
    const [saved, setSaved] = useState<Profile>({
      email: "ada@example.com",
      name: "Ada",
    })
    const save = (input: Profile) => {
      const record = { ...input, name: input.name.trim() }
      setSaved(record)
      return Promise.resolve<ActionResult<Profile>>({ data: record, ok: true })
    }
    const form = useForm({
      defaultValues: saved,
      onSubmit: (submit) => submitAction(submit, save, reset ? { reset } : {}),
      schema: profileSchema,
    })
    formRef.current = form
    const { EmailField, InputField, SubmitButton } = form
    return (
      <FormProvider form={form}>
        <Form>
          <InputField label="Name" name="name" />
          <EmailField label="Email" name="email" />
          <SubmitButton>Submit</SubmitButton>
        </Form>
      </FormProvider>
    )
  }

  test("returns the action's data", async () => {
    const result = await submitAction(
      { formApi: {} as never, value: { id: 1 } },
      (input: { id: number }) =>
        Promise.resolve<ActionResult<string>>({
          data: `saved ${input.id}`,
          ok: true,
        })
    )
    expect(result).toEqual({ data: "saved 1", ok: true })
  })

  test("without reset, the form stays dirty after the save", async () => {
    const user = userEvent.setup()
    const formRef: { current: unknown } = { current: undefined }
    render(<SavedForm formRef={formRef} />)

    await user.type(screen.getByLabelText(NAME_LABEL), " Lovelace ")
    await user.click(screen.getByRole("button", SUBMIT))

    const form = formRef.current as FormState
    await vi.waitFor(() => expect(form.state.isDefaultValue).toBe(false))
    expect(form.state.isDirty).toBe(true)
    expect(form.state.values.name).toBe("Ada Lovelace ")
  })

  test("reset: true rebases the form on the returned data", async () => {
    const user = userEvent.setup()
    const formRef: { current: unknown } = { current: undefined }
    render(<SavedForm formRef={formRef} reset />)

    await user.type(screen.getByLabelText(NAME_LABEL), " Lovelace ")
    await user.click(screen.getByRole("button", SUBMIT))

    await vi.waitFor(() =>
      expect((formRef.current as FormState).state.values.name).toBe(
        "Ada Lovelace"
      )
    )
    const form = formRef.current as FormState
    expect(form.state.isDefaultValue).toBe(true)
    expect(form.state.isDirty).toBe(false)
  })

  test('reset: "values" rebases the form on the submitted values', async () => {
    const user = userEvent.setup()
    const formRef: { current: unknown } = { current: undefined }
    render(<SavedForm formRef={formRef} reset="values" />)

    await user.type(screen.getByLabelText(NAME_LABEL), " Lovelace")
    await user.click(screen.getByRole("button", SUBMIT))

    const form = formRef.current as FormState
    await vi.waitFor(() => expect(form.state.isDirty).toBe(false))
    expect(form.state.values.name).toBe("Ada Lovelace")
    expect(form.state.isDefaultValue).toBe(true)
  })
})
