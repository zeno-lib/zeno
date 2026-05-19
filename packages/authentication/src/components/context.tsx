"use client"

import type { SupabaseClient } from "@zeno-lib/supabase/client"
import { toast } from "@zeno-lib/ui/sonner"
import { useRouter } from "next/navigation"
import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useCallback,
  useContext,
  useState,
} from "react"

// Helper function to safely get origin
const getBaseUrl = () => {
  if (
    typeof globalThis !== "undefined" &&
    globalThis?.location?.origin !== undefined
  ) {
    return globalThis.location.origin
  }
  // Provide a default or handle server-side case appropriately
  // Using NEXT_PUBLIC_SITE_URL environment variable is a common pattern
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
}

export type AuthView =
  | "recover-password"
  | "reset-password"
  | "sign-in-password"
  | "sign-in-magic-link"
  | "sign-out"
  | "sign-up"
  | "verify"

interface AuthState {
  email: string
  handleSubmit: (
    view: AuthView
  ) => (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  loading: boolean
  password: string
  setEmail: Dispatch<SetStateAction<string>>
  setPassword: Dispatch<SetStateAction<string>>
}

const defaultHandleSubmit = () => Promise.resolve()
const defaultAuthState: AuthState = {
  email: "",
  handleSubmit: () => defaultHandleSubmit,
  loading: false,
  password: "",
  setEmail: () => "",
  setPassword: () => "",
}

const AuthFormContext = createContext<AuthState>(defaultAuthState)
export const useAuthForm = () => useContext(AuthFormContext)

async function submitRecoverPassword(
  supabase: SupabaseClient,
  email: string,
  redirectTo: string
): Promise<void> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  })
  if (error) {
    toast.error(error.message)
    return
  }
  toast.message("Please check your email for a password reset link.")
}

async function submitResetPassword(
  supabase: SupabaseClient,
  password: string,
  router: ReturnType<typeof useRouter>
): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    toast.error(error.message)
    return
  }
  toast.message("Password updated successfully")
  router.push("/")
}

async function submitSignInPassword(
  supabase: SupabaseClient,
  email: string,
  password: string
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) {
    toast.error(error.message)
  }
}

async function submitSignInMagicLink(
  supabase: SupabaseClient,
  email: string,
  redirectTo: string,
  router: ReturnType<typeof useRouter>
): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: redirectTo,
      shouldCreateUser: false,
    },
  })
  if (error) {
    toast.error(error.message)
    return
  }
  router.push("/email-sent")
}

// case "sign-up": {
//   const {
//     data: { session, user },
//     error,
//   } = await supabase.auth.signUp({
//     email,
//     options: { emailRedirectTo: redirectTo },
//     password,
//   })
//
//   if (error) {
//     throw error
//   } else if (user && !session) {
//     toast.message("Please check your email for a verification link.")
//   }
//   break
// }

interface AuthProviderProps {
  appBaseUrl?: string
  children: ReactNode
  resetPasswordRedirectPath?: string
  supabase: SupabaseClient
  verifyRedirectPath?: string
}

export const AuthProvider = ({
  appBaseUrl,
  children,
  verifyRedirectPath: _verifyRedirectPath = "/verify",
  supabase,
}: AuthProviderProps) => {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const router = useRouter()
  const redirectTo = appBaseUrl || getBaseUrl()

  const handleSubmit = useCallback(
    (view: AuthView) => async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setLoading(true)
      try {
        switch (view) {
          case "recover-password":
            await submitRecoverPassword(supabase, email, redirectTo)
            break
          case "reset-password":
            await submitResetPassword(supabase, password, router)
            break
          case "sign-in-password":
            await submitSignInPassword(supabase, email, password)
            break
          case "sign-in-magic-link":
            await submitSignInMagicLink(supabase, email, redirectTo, router)
            break
          default:
            break
        }
      } catch (error) {
        if (error instanceof Error) {
          toast.error(error.message)
        }
        throw error
      } finally {
        setLoading(false)
      }
    },
    [email, password, redirectTo, router, supabase]
  )

  return (
    <AuthFormContext.Provider
      value={{
        email,
        handleSubmit,
        loading,
        password,
        setEmail,
        setPassword,
      }}
    >
      {children}
    </AuthFormContext.Provider>
  )
}
