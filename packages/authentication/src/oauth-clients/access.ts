/**
 * Whether the caller may register, rotate and delete your project's OAuth
 * clients. The actions in `./actions` call it first, and each of them is a
 * public endpoint, so it refuses everyone until you fill it in from the
 * caller's verified claims, for example:
 *
 * ```ts
 * const supabase = await createClient() // @zeno-lib/supabase/next-server
 * const { data } = await supabase.auth.getClaims()
 * return data?.claims.app_metadata?.role === "admin"
 * ```
 */
// biome-ignore lint/suspicious/useAwait: the check you write here awaits the session.
export async function canManageOAuthClients(): Promise<boolean> {
  return false
}
