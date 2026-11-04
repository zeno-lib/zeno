"use client"

import type { OAuthClientTokenEndpointAuthMethod } from "@supabase/supabase-js"
import { type FormEvent, useCallback, useEffect, useState } from "react"
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Textarea } from "@/components/ui/textarea"
import {
  deleteOAuthClient,
  listOAuthClients,
  type OAuthClientSummary,
  registerOAuthClient,
  rotateOAuthClientSecret,
} from "./actions"

const AUTH_METHODS: {
  label: string
  value: OAuthClientTokenEndpointAuthMethod
}[] = [
  {
    label: "Secret in the request body (client_secret_post)",
    value: "client_secret_post",
  },
  {
    label: "Secret in a Basic header (client_secret_basic)",
    value: "client_secret_basic",
  },
  { label: "No secret, public client (none)", value: "none" },
]

const LINE_BREAK = /\s+/u

/** Shows a secret once, with the warning that it won't be shown again. */
function SecretDialog({
  clientName,
  onClose,
  secret,
}: {
  clientName: string
  onClose: () => void
  secret: string
}) {
  return (
    <Dialog onOpenChange={(open) => !open && onClose()} open>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>The secret of {clientName}</DialogTitle>
          <DialogDescription>
            Copy it into the app now: it is not shown again. If it is lost,
            rotate it.
          </DialogDescription>
        </DialogHeader>
        <Input
          onFocus={(event) => event.target.select()}
          readOnly
          value={secret}
        />
        <DialogFooter>
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(secret)
              toast.message("Secret copied")
            }}
          >
            Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RegisterDialog({
  onRegistered,
}: {
  onRegistered: (client: OAuthClientSummary, secret: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    const result = await registerOAuthClient({
      name: String(form.get("name") ?? ""),
      redirectUris: String(form.get("redirectUris") ?? "")
        .split(LINE_BREAK)
        .filter(Boolean),
      tokenEndpointAuthMethod: String(
        form.get("tokenEndpointAuthMethod")
      ) as OAuthClientTokenEndpointAuthMethod,
    })
    setPending(false)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setOpen(false)
    onRegistered(result.data.client, result.data.secret)
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger render={<Button />}>Register an app</DialogTrigger>
      <DialogContent>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Register an app</DialogTitle>
            <DialogDescription>
              An OAuth client that may ask your users for access, such as an AI
              client's connector.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="oauth-client-name">Name</FieldLabel>
            <Input id="oauth-client-name" name="name" required />
            <FieldDescription>
              Users see it on the consent screen and in their connected apps.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-redirect-uris">
              Redirect URLs
            </FieldLabel>
            <Textarea
              id="oauth-client-redirect-uris"
              name="redirectUris"
              required
            />
            <FieldDescription>
              One per line, from the app's docs.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="oauth-client-auth-method">
              How it sends its secret
            </FieldLabel>
            <NativeSelect
              defaultValue="client_secret_post"
              id="oauth-client-auth-method"
              name="tokenEndpointAuthMethod"
            >
              {AUTH_METHODS.map((method) => (
                <NativeSelectOption key={method.value} value={method.value}>
                  {method.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>
              It must match the app, or its token request fails.
            </FieldDescription>
          </Field>
          <DialogFooter>
            <Button disabled={pending} type="submit">
              {pending ? "Registering…" : "Register"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ConfirmButton({
  action,
  children,
  description,
  title,
}: {
  action: () => void
  children: string
  description: string
  title: string
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" />}>
        {children}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={action}>{children}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/**
 * The admin list of your project's OAuth clients: register one, rotate its
 * secret, delete it. It runs the server actions in `./actions`, which refuse
 * every caller until you fill in `canManageOAuthClients` in `./access`.
 */
export function OAuthClients() {
  const [clients, setClients] = useState<OAuthClientSummary[] | null>(null)
  const [shown, setShown] = useState<{ name: string; secret: string } | null>(
    null
  )

  const load = useCallback(async () => {
    const result = await listOAuthClients()
    if (!result.ok) {
      toast.error(result.error)
      setClients([])
      return
    }
    setClients(result.data)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const rotate = async (client: OAuthClientSummary) => {
    const result = await rotateOAuthClientSecret(client.client_id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    if (result.data.secret) {
      setShown({ name: client.client_name, secret: result.data.secret })
    }
  }

  const remove = async (client: OAuthClientSummary) => {
    const result = await deleteOAuthClient(client.client_id)
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    toast.message(`${client.client_name} is deleted`)
    await load()
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <RegisterDialog
          onRegistered={(client, secret) => {
            if (secret) {
              setShown({ name: client.client_name, secret })
            }
            load()
          }}
        />
      </div>
      {clients === null && (
        <p className="text-muted-foreground text-sm" role="status">
          Loading apps…
        </p>
      )}
      {clients?.length === 0 && (
        <p className="text-muted-foreground text-sm">No app is registered.</p>
      )}
      {clients && clients.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {clients.map((client) => (
            <li
              className="flex items-start justify-between gap-4 p-4"
              key={client.client_id}
            >
              <div className="min-w-0 text-sm">
                <p className="font-medium text-base">{client.client_name}</p>
                <p className="break-all font-mono text-muted-foreground">
                  {client.client_id}
                </p>
                <p className="text-muted-foreground">
                  {client.token_endpoint_auth_method} ·{" "}
                  {client.redirect_uris.join(", ")}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                {client.client_type === "confidential" && (
                  <ConfirmButton
                    action={() => rotate(client)}
                    description="The current secret stops working at once. Paste the new one into the app."
                    title={`Rotate the secret of ${client.client_name}?`}
                  >
                    Rotate secret
                  </ConfirmButton>
                )}
                <ConfirmButton
                  action={() => remove(client)}
                  description="Every user who connected it is disconnected. To use it again, register it again and update the app."
                  title={`Delete ${client.client_name}?`}
                >
                  Delete
                </ConfirmButton>
              </div>
            </li>
          ))}
        </ul>
      )}
      {shown && (
        <SecretDialog
          clientName={shown.name}
          onClose={() => setShown(null)}
          secret={shown.secret}
        />
      )}
    </div>
  )
}
