"use server"

import type {
  OAuthClient,
  OAuthClientTokenEndpointAuthMethod,
} from "@supabase/supabase-js"
import { createAdminClient } from "@zeno-lib/supabase/client"
import { z } from "zod"
import { canManageOAuthClients } from "./access"

/**
 * An action's outcome. Failures come back as data: Next.js redacts a thrown
 * server action error in production, and Auth's message (an invalid redirect
 * URI, say) is the one the admin needs.
 */
export type OAuthClientsResult<TData> =
  | { data: TData; ok: true }
  | { error: string; ok: false }

/** A registered client, without its secret, which Auth returns only once. */
export type OAuthClientSummary = Pick<
  OAuthClient,
  | "client_id"
  | "client_name"
  | "client_type"
  | "created_at"
  | "redirect_uris"
  | "token_endpoint_auth_method"
>

export type RegisterOAuthClientInput = {
  name: string
  redirectUris: string[]
  tokenEndpointAuthMethod: OAuthClientTokenEndpointAuthMethod
}

const registerSchema = z.object({
  name: z.string().trim().min(1),
  redirectUris: z.array(z.url()).min(1),
  tokenEndpointAuthMethod: z.enum([
    "client_secret_post",
    "client_secret_basic",
    "none",
  ]),
})

const clientIdSchema = z.string().min(1)

const summarize = (client: OAuthClient): OAuthClientSummary => ({
  client_id: client.client_id,
  client_name: client.client_name,
  client_type: client.client_type,
  created_at: client.created_at,
  redirect_uris: client.redirect_uris,
  token_endpoint_auth_method: client.token_endpoint_auth_method,
})

const refused = { error: "You can't manage OAuth clients", ok: false } as const

// The secret-key client: it bypasses RLS, so only after the access check.
const oauthAdmin = () => createAdminClient().auth.admin.oauth

/** Every registered OAuth client, newest first. */
export async function listOAuthClients(): Promise<
  OAuthClientsResult<OAuthClientSummary[]>
> {
  if (!(await canManageOAuthClients())) {
    return refused
  }
  const clients: OAuthClient[] = []
  for (let page = 1; ; page += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: each page says whether there is a next one.
    const { data, error } = await oauthAdmin().listClients({
      page,
      perPage: 100,
    })
    if (error) {
      return { error: error.message, ok: false }
    }
    clients.push(...data.clients)
    if (!data.nextPage) {
      break
    }
  }
  return {
    data: clients
      .map(summarize)
      .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    ok: true,
  }
}

/**
 * Registers a client and returns its secret, which Auth never shows again. A
 * hosted connector that sends its secret in the token request's body (Claude
 * does) needs `client_secret_post`; a mismatch fails at the token exchange.
 */
export async function registerOAuthClient(
  input: RegisterOAuthClientInput
): Promise<
  OAuthClientsResult<{ client: OAuthClientSummary; secret: string | null }>
> {
  if (!(await canManageOAuthClients())) {
    return refused
  }
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) {
    return { error: "Give a name and at least one redirect URL", ok: false }
  }
  const { name, redirectUris, tokenEndpointAuthMethod } = parsed.data
  // `client_name`: a `name` key is ignored, and the client is created unnamed.
  const { data, error } = await oauthAdmin().createClient({
    client_name: name,
    redirect_uris: redirectUris,
    token_endpoint_auth_method: tokenEndpointAuthMethod,
  })
  if (error) {
    return { error: error.message, ok: false }
  }
  return {
    data: { client: summarize(data), secret: data.client_secret ?? null },
    ok: true,
  }
}

/** Issues a new secret; the old one stops working at once. */
export async function rotateOAuthClientSecret(
  clientId: string
): Promise<OAuthClientsResult<{ secret: string | null }>> {
  if (!(await canManageOAuthClients())) {
    return refused
  }
  const parsed = clientIdSchema.safeParse(clientId)
  if (!parsed.success) {
    return { error: "No such client", ok: false }
  }
  const { data, error } = await oauthAdmin().regenerateClientSecret(parsed.data)
  if (error) {
    return { error: error.message, ok: false }
  }
  return { data: { secret: data.client_secret ?? null }, ok: true }
}

/** Deletes a client, which disconnects every user who approved it. */
export async function deleteOAuthClient(
  clientId: string
): Promise<OAuthClientsResult<null>> {
  if (!(await canManageOAuthClients())) {
    return refused
  }
  const parsed = clientIdSchema.safeParse(clientId)
  if (!parsed.success) {
    return { error: "No such client", ok: false }
  }
  const { error } = await oauthAdmin().deleteClient(parsed.data)
  if (error) {
    return { error: error.message, ok: false }
  }
  return { data: null, ok: true }
}
