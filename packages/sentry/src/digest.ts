/**
 * The hash Next.js gives a server-side error. The browser receives it in place
 * of the message, and `onRequestError` receives it on the original, so it ties
 * the two events together.
 *
 * A `NEXT_` digest marks control flow (`redirect()`, `notFound()`,
 * `forbidden()`, `unauthorized()`), not a failure: the server reports nothing
 * for it, so there is no event to tie the browser copy to.
 */
export function getDigest(error: unknown) {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return
  }
  const { digest } = error
  return typeof digest === "string" && !digest.startsWith("NEXT_")
    ? digest
    : undefined
}
