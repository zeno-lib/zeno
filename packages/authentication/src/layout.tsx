"use client"

import type { ComponentProps, ReactNode } from "react"

import { AuthProvider } from "./components/context"
import { Welcome } from "./components/welcome"

type AuthProviderProps = ComponentProps<typeof AuthProvider>

interface AuthLayoutProps
  extends Pick<
    AuthProviderProps,
    | "appBaseUrl"
    | "resetPasswordRedirectPath"
    | "supabase"
    | "verifyRedirectPath"
  > {
  children: ReactNode
  footer?: ReactNode
  imageUrl: string
  LocaleToggle?: React.ComponentType
  Logo?: React.ComponentType<{ className?: string }>
  ThemeToggle?: React.ComponentType
  title: string
}

export function AuthLayout({
  appBaseUrl,
  children,
  imageUrl,
  Logo,
  LocaleToggle,
  resetPasswordRedirectPath,
  supabase,
  ThemeToggle,
  title,
  verifyRedirectPath,
}: Readonly<AuthLayoutProps>) {
  return (
    <AuthProvider
      appBaseUrl={appBaseUrl}
      resetPasswordRedirectPath={resetPasswordRedirectPath}
      supabase={supabase}
      verifyRedirectPath={verifyRedirectPath}
    >
      <main className="flex min-h-screen flex-1 flex-col lg:flex-row">
        <Welcome className="hidden lg:flex" imageUrl={imageUrl} title={title} />
        <div className="flex flex-1 flex-col gap-8 bg-2 p-8">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center">
              {Logo && <Logo className="h-8 lg:hidden" />}
              <div className="font-title text-muted-foreground lg:hidden">
                &nbsp;&nbsp;/&nbsp;&nbsp;
              </div>
              <div className="font-title text-black lg:hidden dark:text-white">
                {title}
              </div>
            </div>
            {(LocaleToggle || ThemeToggle) && (
              <div className="flex items-center gap-2">
                {LocaleToggle && <LocaleToggle />}
                {ThemeToggle && <ThemeToggle />}
              </div>
            )}
          </div>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="flex w-full flex-col justify-center gap-8 sm:max-w-md">
              {children}
            </div>
          </div>
        </div>
        <Welcome className="lg:hidden" imageUrl={imageUrl} title={title} />
      </main>
    </AuthProvider>
  )
}
