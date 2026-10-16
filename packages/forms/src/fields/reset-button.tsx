"use client"

import { useFormContext } from "@zeno-lib/forms/lib/contexts"
import { useIsFormDisabled } from "@zeno-lib/forms/lib/form-disabled"
import type { ComponentProps, ReactNode } from "react"
import { Button } from "@/components/ui/button"

type ResetButtonProps = Omit<ComponentProps<typeof Button>, "onClick" | "type">

function ResetButton({
  children,
  disabled,
  variant = "outline",
  ...props
}: ResetButtonProps) {
  const form = useFormContext()
  const isDisabled = useIsFormDisabled(form) || Boolean(disabled)
  return (
    <Button
      disabled={isDisabled}
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
