import type { Metadata } from "next"
import { ClosingCta } from "@/components/home/closing-cta"
import { Hero } from "@/components/home/hero"
import { Principles } from "@/components/home/principles"
import { Ships } from "@/components/home/ships"
import { Stack } from "@/components/home/stack"
import "./home.css"

export const metadata: Metadata = {
  description:
    "Zeno is an opinionated, high level framework for React and Next.js. Database, authentication, forms, UI and CI arrive assembled, and the source lands in your repository.",
  title: "Zeno, the full stack React framework",
}

export default function HomePage() {
  // The corner dots straddle the column rules, so they hang 1.5px past the
  // viewport once the column runs full width. Clip rather than scroll.
  return (
    <main className="flex flex-1 flex-col overflow-x-clip">
      <Hero />
      <Ships />
      <Stack />
      <Principles />
      <ClosingCta />
    </main>
  )
}
