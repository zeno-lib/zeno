import type { QuerySuspenseErrorFallbackProps } from "@zeno-lib/query/query-suspense"
import type { ComponentProps, ComponentPropsWithoutRef, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type QueryErrorFallbackProps = QuerySuspenseErrorFallbackProps &
  Omit<ComponentPropsWithoutRef<"div">, "children"> & {
    /** Shown when `error.message` is empty (unless `message` is set). */
    fallbackMessage?: string
    /** Replaces the default message block entirely. */
    message?: ReactNode
    /** Merged with the default `<p>` when using the built-in message. */
    messageClassName?: string
    retryLabel?: string
    /** Hide the default retry control (e.g. a read-only error surface). */
    hideRetry?: boolean
    /** Spread onto the default retry `Button` (`onClick` is always wired to `onRetry`). */
    retryButtonProps?: Omit<
      ComponentProps<typeof Button>,
      "children" | "onClick" | "type"
    >
    /** Rendered between the message and the retry button. */
    children?: ReactNode
    /** Drop the built-in message and `children`, keeping the retry button (and `message`, if set). */
    buttonOnly?: boolean
  }

/**
 * `errorFallback` UI for `QuerySuspense`: the error message plus an optional retry button. The
 * root is a `div` with flex layout defaults; override with `className` / other `div` props, or
 * use `message` / `children` for full customization.
 *
 * ```tsx
 * <QuerySuspense
 *   fallback={<NotesSkeleton />}
 *   errorFallback={(props) => (
 *     <QueryErrorFallback {...props} fallbackMessage="Could not load notes." />
 *   )}
 * >
 * ```
 */
export function QueryErrorFallback({
  error,
  onRetry,
  fallbackMessage,
  message,
  messageClassName,
  retryLabel = "Try again",
  hideRetry = false,
  retryButtonProps,
  children,
  className,
  buttonOnly = false,
  ...props
}: QueryErrorFallbackProps) {
  const text =
    error.message.trim() || fallbackMessage || "Something went wrong."

  return (
    <div
      className={cn("flex flex-col items-center gap-4", className)}
      {...props}
    >
      {message}
      {!buttonOnly && message === undefined && (
        <p
          className={cn(
            "text-center text-muted-foreground text-sm",
            messageClassName
          )}
        >
          {text}
        </p>
      )}
      {!buttonOnly && children}
      {!hideRetry && (
        <Button
          onClick={onRetry}
          type="button"
          variant="secondary"
          {...retryButtonProps}
        >
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
