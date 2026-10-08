import { act, cleanup, render, screen } from "@zeno-lib/test/testing-library"
import { afterEach, describe, expect, test, vi } from "vitest"
import { z } from "zod"
import { useForm } from "./create-form"
import { useFormValues } from "./lib/use-form-values"

afterEach(() => {
  cleanup()
})

const schema = z.object({ city: z.string(), name: z.string() })

type Form = ReturnType<typeof useForm<z.infer<typeof schema>>>

function setup() {
  let form: Form | undefined
  const renders = vi.fn()
  function H() {
    form = useForm({ defaultValues: { city: "Bern", name: "Ada" }, schema })
    const { city, name } = useFormValues(form)
    renders()
    return <p data-testid="values">{`${name} ${city}`}</p>
  }
  render(<H />)
  if (!form) {
    throw new Error("form was not created")
  }
  return { form, renders }
}

describe("useFormValues", () => {
  test("returns the current values and follows a change", () => {
    const { form } = setup()
    expect(screen.getByTestId("values").textContent).toBe("Ada Bern")

    act(() => {
      form.setFieldValue("name", "Grace")
    })

    expect(screen.getByTestId("values").textContent).toBe("Grace Bern")
  })

  test("does not re-render when only field meta changes", () => {
    const { form, renders } = setup()
    const before = renders.mock.calls.length

    act(() => {
      form.setFieldMeta("name", (meta) => ({ ...meta, isTouched: true }))
    })

    expect(form.state.fieldMeta.name?.isTouched).toBe(true)
    expect(renders.mock.calls.length).toBe(before)
  })
})
