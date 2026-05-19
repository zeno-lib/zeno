"use client"

import { cn } from "@zeno-lib/ui/lib/utils"
import type { ComponentProps } from "react"

type RequiredIndicatorProps = ComponentProps<"span">

function RequiredIndicator({ className, ...props }: RequiredIndicatorProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("text-destructive", className)}
      data-slot="required-indicator"
      {...props}
    >
      *
    </span>
  )
}

export type { RequiredIndicatorProps }
export { RequiredIndicator }
