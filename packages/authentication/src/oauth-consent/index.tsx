"use client"

import type { OAuthAuthorizationDetails } from "@supabase/supabase-js"
import { createClient } from "@zeno-lib/supabase/next-client"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type Decision = "approve" | "deny"

type ConsentState =
  | { status: "loading" }
  | { message: string; status: "failed" }
  | { details: OAuthAuthorizationDetails; status: "ready" }

interface OAuthConsentProps {
  /** The `authorization_id` query parameter Supabase Auth sends the user here with. */
  authorizationId: string | null | undefined
  /** Your app's name, as the user knows it. */
  productName: string
  /** Where a signed-out user signs in; they come back through `?next=`. */
  signInPath?: string
}

/**
 * The consent screen of Supabase Auth's OAuth 2.1 server: mount it at the
 * project's authorization path (`/oauth/consent`). It sends a signed-out user
 * to sign in and back, shows which app asks for access to which account, and
 * approves or denies. An app the user already approved goes straight back.
 */
export function OAuthConsent({
  authorizationId,
  productName,
  signInPath = "/sign-in",
}: OAuthConsentProps) {
  const [state, setState] = useState<ConsentState>({ status: "loading" })
  const [decision, setDecision] = useState<Decision | null>(null)
  const deciding = useRef(false)

  useEffect(() => {
    let active = true
    const fail = (message: string) => {
      if (active) {
        setState({ message, status: "failed" })
      }
    }

    const load = async () => {
      if (!authorizationId) {
        fail(
          "This page needs an authorization request. Start again from the app."
        )
        return
      }
      const supabase = createClient()
      const { data: session } = await supabase.auth.getClaims()
      if (!session?.claims.sub) {
        const next = `${globalThis.location.pathname}${globalThis.location.search}`
        globalThis.location.replace(
          `${signInPath}?${new URLSearchParams({ next })}`
        )
        return
      }

      const { data, error } =
        await supabase.auth.oauth.getAuthorizationDetails(authorizationId)
      if (error) {
        fail(error.message)
        return
      }
      if (!("authorization_id" in data)) {
        // Approved before: Auth answers with the app's redirect right away.
        globalThis.location.replace(data.redirect_url)
        return
      }
      if (active) {
        setState({ details: data, status: "ready" })
      }
    }

    load()
    return () => {
      active = false
    }
  }, [authorizationId, signInPath])

  const decide = useCallback(
    async (choice: Decision) => {
      if (!authorizationId || deciding.current) {
        return
      }
      deciding.current = true
      setDecision(choice)
      const supabase = createClient()
      const options = { skipBrowserRedirect: true }
      const { data, error } =
        choice === "approve"
          ? await supabase.auth.oauth.approveAuthorization(
              authorizationId,
              options
            )
          : await supabase.auth.oauth.denyAuthorization(
              authorizationId,
              options
            )
      if (error || !data?.redirect_url) {
        toast.error(
          error?.message ?? "No redirect came back. Start again from the app."
        )
        deciding.current = false
        setDecision(null)
        return
      }
      globalThis.location.assign(data.redirect_url)
    },
    [authorizationId]
  )

  if (state.status !== "ready") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect an app to {productName}</CardTitle>
          <CardDescription
            role={state.status === "failed" ? "alert" : "status"}
          >
            {state.status === "failed" ? state.message : "Loading the request…"}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const { client, redirect_uri, scope, user } = state.details
  const scopes = scope.split(" ").filter(Boolean)
  const rows = [
    ["App", client.name],
    ["Website", client.uri],
    ["Returns to", redirect_uri],
    ["Signed in as", user.email],
    ["Scopes", scopes.join(", ")],
  ].filter(([, value]) => value)

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          Allow {client.name} to use {productName} as you?
        </CardTitle>
        <CardDescription>
          It can read and do what you can in {productName}, and nothing more.
          Allow it only if you recognise it. You can disconnect it later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="divide-y rounded-lg border text-sm">
          {rows.map(([label, value]) => (
            <div className="flex justify-between gap-6 p-3" key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-all text-right font-medium">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button
          disabled={decision !== null}
          onClick={() => decide("deny")}
          variant="outline"
        >
          {decision === "deny" ? "Denying…" : "Deny"}
        </Button>
        <Button disabled={decision !== null} onClick={() => decide("approve")}>
          {decision === "approve" ? "Allowing…" : "Allow"}
        </Button>
      </CardFooter>
    </Card>
  )
}
