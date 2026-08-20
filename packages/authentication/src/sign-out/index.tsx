"use client"

import type { SupabaseClient } from "@supabase/supabase-js"
import { useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"

export function SignOut({ supabase }: { supabase: SupabaseClient }) {
  const router = useRouter()
  supabase.auth.signOut().then(() => router.push("/sign-in"))

  return (
    <div className="flex h-full items-center justify-center">
      <Spinner />
    </div>
  )
}
