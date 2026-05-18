"use client"

import { Button } from "@zeno-lib/ui/button"
import { cn } from "@zeno-lib/ui/lib/utils"
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react"

function isShikiBlock(child: ReactNode) {
  if (!isValidElement(child)) {
    return false
  }
  const className = (child.props as { className?: string }).className
  return typeof className === "string" && className.includes("shiki")
}

// Threshold below which the code block fits without a "View Code" overlay.
// Tuned so anything under ~6 lines renders fully expanded.
const COLLAPSE_THRESHOLD_PX = 156

export function Preview({
  className,
  children,
  ...props
}: ComponentProps<"div">) {
  const [expanded, setExpanded] = useState(false)
  const [needsCollapse, setNeedsCollapse] = useState(true)
  const codeContainerRef = useRef<HTMLDivElement>(null)
  const items = Children.toArray(children)
  const code = items.find(isShikiBlock)
  const preview = items.filter((item) => !isShikiBlock(item))

  useEffect(() => {
    if (codeContainerRef.current) {
      setNeedsCollapse(
        codeContainerRef.current.scrollHeight > COLLAPSE_THRESHOLD_PX
      )
    }
  }, [])

  if (!code) {
    return (
      <div
        className={cn(
          "not-prose flex min-h-40 w-full items-center justify-center rounded-xl border bg-card p-6",
          className
        )}
        {...props}
      >
        {preview}
      </div>
    )
  }

  const shouldCollapse = needsCollapse && !expanded

  return (
    <div
      className={cn(
        "not-prose w-full overflow-hidden rounded-xl border bg-card",
        className
      )}
      {...props}
    >
      <div className="flex min-h-40 items-center justify-center p-6">
        {preview}
      </div>
      <div
        className={cn(
          "relative border-t bg-muted/40",
          "[&_figure]:my-0! [&_figure]:rounded-none! [&_figure]:border-0! [&_figure]:bg-transparent! [&_figure]:shadow-none!",
          shouldCollapse && [
            "max-h-26 overflow-hidden",
            "[&_[role=region]]:overflow-hidden! [&_[role=region]]:max-h-none!",
          ]
        )}
        ref={codeContainerRef}
      >
        {code}
        {shouldCollapse && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-muted/80 via-muted/40 to-transparent">
            <Button
              onClick={() => setExpanded(true)}
              size="sm"
              variant="outline"
            >
              View Code
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
