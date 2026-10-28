"use client"

import { useEffect } from "react"

const SCROLL_THRESHOLD = 0

function clampOffset(offset: number, delta: number, max: number): number {
  return Math.min(Math.max(offset + delta, 0), max)
}

export function NavbarScrollHide() {
  useEffect(() => {
    let lastScrollY = window.scrollY
    let navOffset = 0
    let rafId = 0

    function getNavHeight(nav: HTMLElement): number {
      const headerTabs = document.querySelector<HTMLElement>("#nd-header-tabs")
      const tabsHeight = headerTabs?.offsetHeight ?? 0
      return nav.offsetHeight + tabsHeight + 1
    }

    function applyTransforms(
      nav: HTMLElement | null,
      delta: number,
      belowThreshold: boolean
    ) {
      if (belowThreshold) {
        navOffset = 0
      } else if (nav) {
        navOffset = clampOffset(navOffset, delta, getNavHeight(nav))
      }

      if (nav) {
        const navMax = getNavHeight(nav)
        const progress = navMax > 0 ? navOffset / navMax : 0

        nav.style.transform = `translate3d(0, ${-navOffset}px, 0)`
        document.documentElement.style.setProperty(
          "--nd-nav-hide-progress",
          String(progress)
        )
      }
    }

    function onScroll() {
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        const nav = document.querySelector<HTMLElement>("#nd-nav")
        const currentScrollY = window.scrollY
        const delta = currentScrollY - lastScrollY

        applyTransforms(nav, delta, currentScrollY <= SCROLL_THRESHOLD)

        lastScrollY = currentScrollY
      })
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return null
}
