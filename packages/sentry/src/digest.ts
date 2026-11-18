/**
 * The hash Next.js gives a server-side error. The browser receives it in place
 * of the message, and `onRequestError` receives it on the original, so it ties
 * the two events together.
 */
export function getDigest(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return
  }
  return typeof error.digest === "string" ? error.digest : undefined
}
