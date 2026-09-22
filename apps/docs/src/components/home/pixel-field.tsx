"use client"

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react"

export const DOMAINS = [
  { key: "d", label: "Data" },
  { key: "u", label: "Users" },
  { key: "i", label: "Interface" },
  { key: "q", label: "Quality" },
] as const

export type DomainKey = (typeof DOMAINS)[number]["key"]

type PixelField = {
  active: DomainKey | null
  setActive: (domain: DomainKey | null) => void
}

const PixelFieldContext = createContext<PixelField>({
  active: null,
  setActive: () => {
    /* no provider: the canvas simply never highlights */
  },
})

/** Lets the content below the canvas drive which colour region it lights up. */
export function PixelFieldProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<DomainKey | null>(null)
  const value = useMemo(() => ({ active, setActive }), [active])
  return <PixelFieldContext value={value}>{children}</PixelFieldContext>
}

export function usePixelField() {
  return useContext(PixelFieldContext)
}
