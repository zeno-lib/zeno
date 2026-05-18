import type { EmailOtpType } from "@zeno-lib/supabase/client"
import { createClient } from "@zeno-lib/supabase/server"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"

const defaultNexts: Record<EmailOtpType, string> = {
  email: "/",
  email_change: "/",
  invite: "/reset-password",
  magiclink: "/",
  recovery: "/reset-password",
  signup: "/reset-password",
}

export async function getRoute(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = searchParams.get("next") ?? (type ? defaultNexts[type] : "/")

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
