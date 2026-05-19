/**
 * This page exists to guard against email prefetching by email providers.
 *
 * Certain email providers (e.g. Safe Links in Microsoft Defender for Office 365)
 * have spam detection or security features that prefetch URL links from incoming emails.
 * This would consume the confirmation URL instantly, leading to a "Token has expired or is invalid" error.
 *
 * By requiring users to click a button to confirm, we prevent automated prefetching
 * from invalidating the token before the user can use it.
 *
 * @see https://supabase.com/docs/guides/auth/auth-email-templates#email-prefetching
 */
"use client"

import { Button } from "@zeno-lib/ui/button"
import { toast } from "@zeno-lib/ui/sonner"
import { useRouter, useSearchParams } from "next/navigation"
import { useCallback, useState } from "react"
import { Container } from "../components/container"

interface VerifyProps {
  buttonLabel?: string
  onError?: (error: Error, context?: Record<string, unknown>) => void
  title?: string
}

export function Verify({
  buttonLabel = "Confirm email",
  onError,
  title = "Verify your email",
}: VerifyProps = {}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const next = searchParams.get("next")

  const handleRedirect = useCallback(() => {
    setLoading(true)
    if (token_hash && type) {
      const params = new URLSearchParams({ token_hash, type })
      if (next) {
        params.set("next", next)
      }
      router.replace(`/confirm?${params}`)
    } else {
      toast.error("Something went wrong", {
        description: "Please try logging in again.",
      })
      onError?.(
        new Error(
          "Verify email redirect failed: missing token_hash or type query parameters"
        ),
        { next, token_hash, type }
      )
      setLoading(false)
      router.push("/sign-in")
    }
  }, [token_hash, type, next, onError, router])

  // Auto-redirect if the page is accessed directly with the token
  // useEffect(() => {
  //   handleRedirect()
  // }, [handleRedirect])

  return (
    <Container
      subtitle="Click the button below to complete your sign-in process."
      title={title}
    >
      <Button disabled={loading} onClick={handleRedirect}>
        {buttonLabel}
      </Button>
    </Container>
  )
}
