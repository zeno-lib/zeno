"use client"

import { toast } from "@zeno-lib/ui/sonner"

export const wrapperClass = "w-full max-w-sm"

export function toastSubmitted(value: unknown) {
  toast.success("Submitted", {
    description: (
      <pre className="mt-1 overflow-x-auto text-xs">
        {JSON.stringify(value, null, 2)}
      </pre>
    ),
  })
}
