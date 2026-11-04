/**
 * `value` as a path on `origin` to send the user to after sign-in, or `null`
 * when it would leave the app. A same-origin absolute URL (what Supabase puts
 * in an email's `{{ .RedirectTo }}`) comes back as its path; `//other.host`,
 * `/\other.host`, another origin and `javascript:` come back as `null`.
 */
export function safeNextPath(
  value: string | null | undefined,
  origin: string
): string | null {
  if (!value) {
    return null
  }
  let url: URL
  try {
    url = new URL(value, origin)
  } catch {
    return null
  }
  if (url.origin !== new URL(origin).origin) {
    return null
  }
  return `${url.pathname}${url.search}${url.hash}`
}
