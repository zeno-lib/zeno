"use client"

import { Button } from "@zeno-lib/ui/button"
import Link from "next/link"

import { Container } from "../components/container"
import { useAuthForm } from "../components/context"
import { EmailInput } from "../components/inputs"

export function RecoverPassword() {
  const { handleSubmit, loading } = useAuthForm()

  return (
    <Container
      subtitle={
        <>
          Remember your password?&nbsp;
          <Link className="link" href="/sign-in">
            Sign in
          </Link>
        </>
      }
      title="Recover your password"
    >
      <form
        className="flex flex-col gap-6"
        onSubmit={handleSubmit("recover-password")}
      >
        <EmailInput />
        <Button disabled={loading} type="submit">
          Recover
        </Button>
      </form>
    </Container>
  )
}
