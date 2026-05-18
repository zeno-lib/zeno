"use client"

import { Button } from "@zeno-lib/ui/button"
import { toast } from "@zeno-lib/ui/sonner"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

import { Container } from "../components/container"
import { useAuthForm } from "../components/context"
import { PasswordInput } from "../components/inputs"

const PasswordResetContent = () => {
  const { handleSubmit, loading } = useAuthForm()
  const searchParameters = useSearchParams()
  const error = searchParameters.get("error")

  useEffect(() => {
    if (error === "access_denied") {
      toast.error(
        "Email link is invalid or has expired. Be sure to use the most recent link."
      )
    }
  }, [error])

  return (
    <>
      {error === "access_denied" ? (
        <Button
          render={<Link href="/recover-password">Recover password</Link>}
          variant="link"
        />
      ) : (
        <form
          className="flex flex-col gap-6"
          onSubmit={handleSubmit("reset-password")}
        >
          <PasswordInput />
          <Button disabled={loading} type="submit">
            Reset
          </Button>
        </form>
      )}
    </>
  )
}

export function PasswordReset() {
  return (
    <Container title="Enter your new password">
      <Suspense>
        <PasswordResetContent />
      </Suspense>
    </Container>
  )
}
