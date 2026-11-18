import type { ErrorEvent, EventHint } from "@sentry/nextjs"
import { getDigest } from "./digest"
import type { SentryOptions } from "./options"

/**
 * A server function or server render failure reaches the browser with a
 * `digest` and, in production, a redacted message. The server already
 * reported the original, so the browser copy only exists to carry the replay:
 * Replay keeps a buffered recording only once an error event is sent, so
 * dropping the copy would lose it. Grouping every copy of a page into one
 * issue keeps the replays without one duplicate per server error. The
 * `digest` tag matches the server event (see `request-error.ts`).
 *
 * Browser only. On the server the original error carries the same `digest`,
 * so every server error would land in one issue per page.
 */
export const groupServerReportedErrors = ((
  event: ErrorEvent,
  hint: EventHint
): ErrorEvent => {
  const digest = getDigest(hint.originalException)
  if (!digest) {
    return event
  }

  // A fingerprint the app set on the scope or the capture call wins.
  event.fingerprint ??= [
    "server-function-error",
    event.transaction ?? "unknown",
  ]
  event.tags = { ...event.tags, digest }
  return event
}) satisfies SentryOptions["beforeSend"]
