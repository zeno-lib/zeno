"use client"

import type { SupabaseClient } from "@zeno-lib/supabase/client"
import { Spinner } from "@zeno-lib/ui/spinner"
import { useRouter } from "next/navigation"

export function SignOut({ supabase }: { supabase: SupabaseClient }) {
  const router = useRouter()
  supabase.auth.signOut().then(() => router.push("/sign-in"))

  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  )
}
