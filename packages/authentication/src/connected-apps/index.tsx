"use client"

import type { OAuthGrant } from "@supabase/supabase-js"
import { createClient } from "@zeno-lib/supabase/next-client"
import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" })

/**
 * The apps the signed-in user has allowed to act as them through your OAuth
 * server (an AI client such as Claude, say), each with a Disconnect button.
 * Disconnecting ends the app's refresh token at once; its last access token
 * still works until it expires, unless your bearer routes confirm the session.
 */
export function ConnectedApps() {
  const [grants, setGrants] = useState<OAuthGrant[] | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await createClient().auth.oauth.listGrants()
    if (error) {
      toast.error(error.message)
      setGrants([])
      return
    }
    setGrants(data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const disconnect = async (grant: OAuthGrant) => {
    const { error } = await createClient().auth.oauth.revokeGrant({
      clientId: grant.client.id,
    })
    if (error) {
      toast.error(error.message)
      return
    }
    toast.message(`${grant.client.name} is disconnected`)
    await load()
  }

  if (grants === null) {
    return (
      <p className="text-muted-foreground text-sm" role="status">
        Loading connected apps…
      </p>
    )
  }
  if (grants.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        No app is connected to your account.
      </p>
    )
  }

  return (
    <ul className="divide-y rounded-lg border">
      {grants.map((grant) => (
        <li
          className="flex items-center justify-between gap-4 p-4"
          key={grant.client.id}
        >
          <div className="min-w-0">
            <p className="font-medium">{grant.client.name}</p>
            <p className="text-muted-foreground text-sm">
              Connected {formatDate(grant.granted_at)}
              {grant.scopes.length > 0 && ` · ${grant.scopes.join(", ")}`}
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="outline" />}>
              Disconnect
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Disconnect {grant.client.name}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  It stops acting as you. To use it again, you connect it and
                  approve it again.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => disconnect(grant)}>
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </li>
      ))}
    </ul>
  )
}
