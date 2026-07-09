"use client"

import type { ComponentProps } from "react"
import { cn } from "@/lib/utils"

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
