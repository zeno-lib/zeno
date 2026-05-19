"use client"

import { Button } from "@zeno-lib/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@zeno-lib/ui/dialog"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Container } from "../components/container"
import { useAuthForm } from "../components/context"
import { EmailInput, PasswordInput } from "../components/inputs"
import { AboutMagicLinks } from "./about-magic-links"

export function SignIn({
  magicLink = true,
  password = true,
  submitLabel = "Sign in",
  title = "Happy to see you again!",
}: {
  magicLink?: boolean
  password?: boolean
  submitLabel?: string
  title?: string
}) {
  const searchParams = useSearchParams()
  const emailParam = searchParams.get("email")
  const [mode, setMode] = useState<"magic-link" | "password">(
    magicLink ? "magic-link" : "password"
  )
  const { handleSubmit, loading, setEmail } = useAuthForm()

  useEffect(() => {
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [emailParam, setEmail])

  if (!(magicLink || password)) {
    throw new Error("Either magicLink or password must be true")
  }

  return (
    <Container
      // subtitle={
      //   <>
      //     Don&apos;t have an account yet?&nbsp;
      //     <Link className="link" href="/sign-up">
      //       Create an account
      //     </Link>
      //   </>
      // }
      title={title}
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={handleSubmit(
          mode === "magic-link" ? "sign-in-magic-link" : "sign-in-password"
        )}
      >
        <EmailInput />
        {mode === "password" && <PasswordInput />}
        <div className="flex flex-col gap-2">
          <Button disabled={loading} type="submit">
            {submitLabel}
          </Button>

          {mode === "password" && (
            <Button
              render={<Link href="/recover-password">Recover password</Link>}
              variant="link"
            />
          )}
        </div>
      </form>
      {magicLink && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="text-sm leading-tight">
            {mode === "magic-link" && (
              <>You will receive a login link by email. </>
            )}
            <>For your security, we recommend not using a password. </>
            <Dialog disablePointerDismissal>
              <DialogTrigger className="link">Learn more</DialogTrigger>
              <DialogContent>
                <AboutMagicLinks />
              </DialogContent>
            </Dialog>
            .{" "}
            {password && mode === "magic-link" && (
              <button
                className="link"
                onClick={() => setMode("password")}
                type="button"
              >
                Still want to use a password?
              </button>
            )}
            {magicLink && mode === "password" && (
              <button
                className="link"
                onClick={() => setMode("magic-link")}
                type="button"
              >
                Use magic link instead
              </button>
            )}
          </div>
        </div>
      )}
    </Container>
  )
}
