import type { AnyFormApi, ValidationLogicFn } from "@tanstack/react-form"
import { describe, expect, test, vi } from "vitest"

import { blurThenChangeLogic } from "./validation-logic"

type LogicArgs = Parameters<ValidationLogicFn>[0]
type Validators = LogicArgs["validators"]

type ObservedValidator = {
  cause: string
  fn: unknown
}

function makeForm(overrides?: {
  submissionAttempts?: number
  blurredFieldNames?: string[]
}) {
  const fieldMeta: Record<string, { isBlurred: boolean }> = {}
  for (const name of overrides?.blurredFieldNames ?? []) {
    fieldMeta[name] = { isBlurred: true }
  }
  return {
    state: {
      fieldMeta,
      submissionAttempts: overrides?.submissionAttempts ?? 0,
    },
  } as unknown as AnyFormApi
}

function makeRun() {
  const observed: ObservedValidator[][] = []
  const runValidation = vi.fn(
    (props: { form: AnyFormApi; validators: ObservedValidator[] }) => {
      observed.push(props.validators)
      return undefined
    }
  )
  return { observed, runValidation }
}

const SCHEMA_FN = () => undefined
const ASYNC_SCHEMA_FN = async () => undefined

const SCHEMA_VALIDATORS: Validators = {
  onBlur: SCHEMA_FN,
  onChange: SCHEMA_FN,
  onSubmit: SCHEMA_FN,
} as unknown as Validators

const SCHEMA_VALIDATORS_BLUR_ONLY: Validators = {
  onBlur: SCHEMA_FN,
  onSubmit: SCHEMA_FN,
} as unknown as Validators

const SCHEMA_VALIDATORS_ASYNC: Validators = {
  onBlurAsync: ASYNC_SCHEMA_FN,
  onChangeAsync: ASYNC_SCHEMA_FN,
  onSubmitAsync: ASYNC_SCHEMA_FN,
} as unknown as Validators

describe("blurThenChangeLogic — form-level path", () => {
  test("missing validators yields []", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "change", async: false } as LogicArgs["event"],
      form: makeForm(),
      runValidation,
      validators: undefined,
    } as LogicArgs)
    expect(observed[0]).toEqual([])
  })

  test("mount fires onMount only (sync)", () => {
    const onMount = vi.fn()
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "mount", async: false } as LogicArgs["event"],
      form: makeForm(),
      runValidation,
      validators: { onMount } as unknown as Validators,
    } as LogicArgs)
    expect(observed[0]).toHaveLength(1)
    expect(observed[0]?.[0]).toEqual({ cause: "mount", fn: onMount })
  })

  test("mount with async event yields [] (no async mount)", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "mount", async: true } as LogicArgs["event"],
      form: makeForm(),
      runValidation,
      validators: SCHEMA_VALIDATORS,
    } as LogicArgs)
    expect(observed[0]).toEqual([])
  })

  test("blur fires the live validator regardless of state", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "blur", async: false } as LogicArgs["event"],
      form: makeForm(),
      runValidation,
      validators: SCHEMA_VALIDATORS,
    } as LogicArgs)
    expect(observed[0]).toEqual([{ cause: "change", fn: SCHEMA_FN }])
  })

  test("blur falls back to onBlur when onChange is absent", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "blur", async: false } as LogicArgs["event"],
      form: makeForm(),
      runValidation,
      validators: SCHEMA_VALIDATORS_BLUR_ONLY,
    } as LogicArgs)
    expect(observed[0]).toEqual([{ cause: "change", fn: SCHEMA_FN }])
  })

  test("change while pristine yields [] (no field blurred, no submit)", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "change", async: false } as LogicArgs["event"],
      form: makeForm(),
      runValidation,
      validators: SCHEMA_VALIDATORS,
    } as LogicArgs)
    expect(observed[0]).toEqual([])
  })

  test("change after a field was blurred runs the live validator", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "change", async: false } as LogicArgs["event"],
      form: makeForm({ blurredFieldNames: ["email"] }),
      runValidation,
      validators: SCHEMA_VALIDATORS,
    } as LogicArgs)
    expect(observed[0]).toEqual([{ cause: "change", fn: SCHEMA_FN }])
  })

  test("change after a submit attempt runs the live validator", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "change", async: false } as LogicArgs["event"],
      form: makeForm({ submissionAttempts: 1 }),
      runValidation,
      validators: SCHEMA_VALIDATORS,
    } as LogicArgs)
    expect(observed[0]).toEqual([{ cause: "change", fn: SCHEMA_FN }])
  })

  test("sync submit yields live + submit + server placeholder", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "submit", async: false } as LogicArgs["event"],
      form: makeForm(),
      runValidation,
      validators: SCHEMA_VALIDATORS,
    } as LogicArgs)
    expect(observed[0]?.map((v) => v.cause)).toEqual([
      "change",
      "submit",
      "server",
    ])
  })

  test("async submit yields live + submitAsync only (no server placeholder)", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: { type: "submit", async: true } as LogicArgs["event"],
      form: makeForm(),
      runValidation,
      validators: SCHEMA_VALIDATORS_ASYNC,
    } as LogicArgs)
    expect(observed[0]?.map((v) => v.cause)).toEqual(["change", "submit"])
  })
})

describe("blurThenChangeLogic — field-level path", () => {
  function fieldEvent(
    type: "change" | "blur" | "submit" | "mount",
    async = false
  ): LogicArgs["event"] {
    return { async, fieldName: "email", type } as LogicArgs["event"]
  }

  test("field-level change uses validators.onChange directly (no gating)", () => {
    const onChange = vi.fn()
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: fieldEvent("change"),
      form: makeForm(),
      runValidation,
      validators: { onChange } as unknown as Validators,
    } as LogicArgs)
    expect(observed[0]).toEqual([{ cause: "change", fn: onChange }])
  })

  test("field-level blur uses validators.onBlur directly", () => {
    const onBlur = vi.fn()
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: fieldEvent("blur"),
      form: makeForm(),
      runValidation,
      validators: { onBlur } as unknown as Validators,
    } as LogicArgs)
    expect(observed[0]).toEqual([{ cause: "blur", fn: onBlur }])
  })

  test("field-level submit runs change + blur + submit", () => {
    const onChange = vi.fn()
    const onBlur = vi.fn()
    const onSubmit = vi.fn()
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: fieldEvent("submit"),
      form: makeForm(),
      runValidation,
      validators: { onBlur, onChange, onSubmit } as unknown as Validators,
    } as LogicArgs)
    expect(observed[0]?.map((v) => v.cause)).toEqual([
      "change",
      "blur",
      "submit",
    ])
  })

  test("field-level no validators yields []", () => {
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: fieldEvent("change"),
      form: makeForm(),
      runValidation,
      validators: undefined,
    } as LogicArgs)
    expect(observed[0]).toEqual([])
  })

  test("field-level async submit uses async slots", () => {
    const onChangeAsync = vi.fn()
    const onBlurAsync = vi.fn()
    const onSubmitAsync = vi.fn()
    const { observed, runValidation } = makeRun()
    blurThenChangeLogic({
      event: fieldEvent("submit", true),
      form: makeForm(),
      runValidation,
      validators: {
        onBlurAsync,
        onChangeAsync,
        onSubmitAsync,
      } as unknown as Validators,
    } as LogicArgs)
    expect(observed[0]?.map((v) => v.fn)).toEqual([
      onChangeAsync,
      onBlurAsync,
      onSubmitAsync,
    ])
  })
})
