import { captureRequestError, withScope } from "@sentry/nextjs"
import { getDigest } from "./digest"

/**
 * `captureRequestError` with the Next.js `digest` as a tag, so searching
 * `digest:<value>` finds this event and its browser copy, which carries the
 * replay (see `before-send.ts`).
 */
export const onRequestError: typeof captureRequestError = (
  error,
  request,
  errorContext
) => {
  withScope((scope) => {
    const digest = getDigest(error)
    if (digest) {
      scope.setTag("digest", digest)
    }
    captureRequestError(error, request, errorContext)
  })
}
