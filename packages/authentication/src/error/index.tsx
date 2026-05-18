import { createClient } from "@zeno-lib/supabase/server"
import { Button } from "@zeno-lib/ui/button"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Container } from "../components/container"

const isExpiredLinkError = (error?: string) =>
  error === "Email link is invalid or has expired"

export async function ErrorContainer({ error }: { error?: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const isSignedIn = !!user

  // If the user is signed in but the link is expired, redirect to home
  if (isSignedIn && isExpiredLinkError(error)) {
    redirect("/")
  }

  const signInHref = user?.email
    ? `/sign-in?email=${encodeURIComponent(user.email)}`
    : "/sign-in"

  return (
    <Container
      subtitle={
        isExpiredLinkError(error)
          ? "For security reasons, our links are only valid once and for a limited time, make sure you have used the last one you received, or request a new one"
          : "An unexpected error occurred."
      }
      title={
        isExpiredLinkError(error)
          ? "This link has expired"
          : error || "Sorry, something went wrong"
      }
    >
      <div className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row">
          {isSignedIn ? (
            <>
              <Button
                className="md:flex-1"
                render={<Link href="/">Go back home</Link>}
                variant="outline"
              />
              <Button
                className="md:flex-1"
                render={<Link href="/sign-out">Sign out</Link>}
                variant="outline"
              />
            </>
          ) : (
            <Button
              className="md:flex-1"
              render={
                <Link href={signInHref}>
                  {isExpiredLinkError(error)
                    ? "Request a new one"
                    : "Try again"}
                </Link>
              }
              variant="outline"
            />
          )}
        </div>
      </div>
    </Container>
  )
}
