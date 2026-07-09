"use client"

import { useFieldContext } from "@zeno-lib/forms/lib/contexts"
import { InputGroupAddon } from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"

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
