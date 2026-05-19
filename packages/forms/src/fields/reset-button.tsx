"use client"

import { Button } from "@zeno-lib/ui/button"
import type { ComponentProps, ReactNode } from "react"

import { useFormContext } from "../lib/contexts"

type ResetButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "type">

function ResetButton({
  children,
  variant = "outline",
  ...props
}: ResetButtonProps) {
  const form = useFormContext()
  return (
    <Button
      onClick={() => form.reset()}
      type="button"
      variant={variant}
      {...props}
    >
      {(children ?? "Reset") as ReactNode}
    </Button>
  )
}

export type { ResetButtonProps }
export { ResetButton }
