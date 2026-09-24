"use client"

import { Check, Copy } from "@zeno-lib/ui/icons"
import { cn } from "@zeno-lib/ui/lib/utils"
import { useEffect, useRef, useState } from "react"

const RESET_DELAY_MS = 2000

export function CopyCommand({
  className,
  command,
}: {
  className?: string
  command: string
}) {
  const [copied, setCopied] = useState(false)
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (resetRef.current) {
        clearTimeout(resetRef.current)
      }
    },
    []
  )

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(command)
      setCopied(true)
      // Re-arm rather than stack: the pending timer belongs to the previous
      // copy and would clear the check mark early on this one.
      if (resetRef.current) {
        clearTimeout(resetRef.current)
      }
      resetRef.current = setTimeout(() => setCopied(false), RESET_DELAY_MS)
    } catch {
      // Clipboard is unavailable (insecure context, denied permission).
      // The command stays selectable, so there is nothing to recover from.
    }
  }

  return (
    <button
      aria-label={copied ? "Command copied" : `Copy "${command}"`}
      className={cn(
        "group zeno-surface inline-flex max-w-full items-center gap-3 rounded-lg border py-2 pr-2 pl-4 text-left font-mono text-fd-muted-foreground text-xs backdrop-blur-sm transition-colors hover:bg-fd-muted/60 hover:text-fd-foreground sm:text-sm",
        className
      )}
      onClick={copy}
      type="button"
    >
      <span
        aria-hidden="true"
        className="shrink-0 select-none text-fd-muted-foreground/60"
      >
        $
      </span>
      <span className="text-fd-foreground">{command}</span>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-transparent text-fd-muted-foreground group-hover:border-border">
        {copied ? (
          <Check className="size-3.5 text-fd-foreground" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </span>
    </button>
  )
}
