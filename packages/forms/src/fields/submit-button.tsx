"use client"

import { useFormContext } from "@zeno-lib/forms/lib/contexts"
import type { ComponentProps } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

type SubmitButtonProps = Omit<ComponentProps<typeof Button>, "type">

function SubmitButton({ children, disabled, ...props }: SubmitButtonProps) {
  const form = useFormContext()
  return (
    <form.Subscribe
      selector={(state) => [state.canSubmit, state.isSubmitting] as const}
    >
      {([canSubmit, isSubmitting]) => (
        <Button
          disabled={disabled || !canSubmit || isSubmitting}
          type="submit"
          {...props}
        >
          {isSubmitting && <Spinner />}
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}

export { SubmitButton }
