"use client"

import { Button } from "@zeno-lib/ui/button"
import Link from "next/link"

import { Container } from "../components/container"
import { useAuthForm } from "../components/context"
import { EmailInput, PasswordInput } from "../components/inputs"

export default function SignUpPage() {
  const { handleSubmit, loading } = useAuthForm()

  return (
    <Container
      subtitle={
        <>
          Already have an account?&nbsp;
          <Link className="link" href="/sign-in">
            Sign in
          </Link>
        </>
      }
      title="Create an account"
    >
      <form className="flex flex-col gap-6" onSubmit={handleSubmit("sign-up")}>
        <EmailInput />
        <PasswordInput />
        <Button disabled={loading} type="submit">
          Sign up
        </Button>
      </form>
    </Container>
  )
}
