"use client"

import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import type { ChangeEvent } from "react"
import { InputField, type InputFieldProps } from "./input-field"

type NumberFieldProps = Omit<
  InputFieldProps,
  "inputMode" | "onChange" | "type" | "value"
>

function NumberField(props: NumberFieldProps) {
  const field = useFieldContext<number | undefined>()
  const value = field.state.value
  const inputValue =
    typeof value === "number" && !Number.isNaN(value) ? value : ""

  return (
    <InputField
      {...props}
      inputMode="numeric"
      onChange={(event: ChangeEvent<HTMLInputElement>) => {
        const next = event.target.valueAsNumber
        field.handleChange(Number.isNaN(next) ? undefined : next)
      }}
      type="number"
      value={inputValue}
    />
  )
}

export { NumberField }
