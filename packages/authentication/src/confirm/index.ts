import type { EmailOtpType } from "@supabase/supabase-js"
import { createClient } from "@zeno-lib/supabase/next-server"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { safeNextPath } from "./safe-next-path"

const defaultNexts: Record<EmailOtpType, string> = {
  email: "/",
  email_change: "/",
  invite: "/reset-password",
  magiclink: "/",
  recovery: "/reset-password",
  signup: "/reset-password",
}

export async function getRoute(request: NextRequest) {
  const { origin, searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  // Only a path on this app: a `next` that leaves it would make the link an
  // open redirect, signed in. Behind a proxy, `request.url` names the internal
  // host, so the public `NEXT_PUBLIC_SITE_URL` counts as this app too.
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  const next =
    safeNextPath(
      searchParams.get("next"),
      siteUrl ? [origin, siteUrl] : origin
    ) ??
    (type && defaultNexts[type]) ??
    "/"

  if (token_hash && type) {
    const supabase = await createClient()

    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })
    if (error) {
      // redirect the user to an error page with some instructions
      redirect(`/error?error=${error?.message}`)
    } else {
      // redirect user to specified redirect URL or root of app
      redirect(next)
    }
  }

  // redirect the user to an error page with some instructions
  redirect("/error?error=No token hash or type")
}
