"use client"

import { InputGroupAddon } from "@zeno-lib/ui/input-group"
import { Spinner } from "@zeno-lib/ui/spinner"

import { useFieldContext } from "../lib/contexts"

type ValidationSpinnerProps = {
  align?: "inline-start" | "inline-end"
}

function ValidationSpinner({ align = "inline-end" }: ValidationSpinnerProps) {
  const field = useFieldContext()
  if (!field.state.meta.isValidating) {
    return null
  }
  return (
    <InputGroupAddon align={align}>
      <Spinner />
    </InputGroupAddon>
  )
}

export type { ValidationSpinnerProps }
export { ValidationSpinner }
