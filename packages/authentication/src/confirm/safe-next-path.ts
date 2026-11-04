/**
 * `value` as a path on the app to send the user to after sign-in, or `null`
 * when it would leave the app. `origins` are the app's own: the first one
 * resolves a relative `value`, and an absolute one (what Supabase puts in an
 * email's `{{ .RedirectTo }}`) must be on one of them. It comes back as its
 * path. Another origin, `//host`, `/\host`, a path that normalizes to `//host`
 * (`/.//host`) and `javascript:` all come back as `null`.
 */
export function safeNextPath(
  value: string | null | undefined,
  origins: string | readonly string[]
): string | null {
  const allowed = (typeof origins === "string" ? [origins] : origins).map(
    (origin) => new URL(origin).origin
  )
  const [base] = allowed
  if (!(value && base)) {
    return null
  }
  let url: URL
  try {
    url = new URL(value, base)
  } catch {
    return null
  }
  // A path starting `//` is another host to the browser and to `redirect()`.
  if (!allowed.includes(url.origin) || url.pathname.startsWith("//")) {
    return null
  }
  return `${url.pathname}${url.search}${url.hash}`
}
