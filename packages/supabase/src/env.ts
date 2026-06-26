/**
 * Throws a separate error for a missing URL or key, narrowing both to `string`.
 * Used by the client factories to validate the resolved Supabase URL and key.
 */
export function requireSupabaseEnv(
  url: string | undefined,
  key: string | undefined
): { url: string; key: string } {
  if (!url) {
    throw new Error("Missing Supabase URL environment variable")
  }
  if (!key) {
    throw new Error("Missing Supabase key environment variable")
  }
  return { key, url }
}
