import { RootProvider } from "fumadocs-ui/provider/next"
import "./global.css"
import { Toaster } from "@zeno-lib/ui/sonner"
import { HomeLayout } from "fumadocs-ui/layouts/home"
import { Inter } from "next/font/google"
import { Devtools } from "@/components/devtools"
import { NavbarScrollHide } from "@/components/layout/navbar-scroll-hide"
import { homeOptions } from "@/lib/layout.shared"

const inter = Inter({
  subsets: ["latin"],
})

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html className={inter.className} lang="en" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          <HomeLayout {...homeOptions()}>{children}</HomeLayout>
          <Toaster />
        </RootProvider>
        <NavbarScrollHide />
        <Devtools />
      </body>
    </html>
  )
}
