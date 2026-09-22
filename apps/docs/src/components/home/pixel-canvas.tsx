"use client"

import { cn } from "@zeno-lib/ui/lib/utils"
import { useEffect, useRef } from "react"
import { type DomainKey, usePixelField } from "@/components/home/pixel-field"

const CELL = 9
const GAP = 1
const STEP = CELL + GAP
const SEED = 13.37
const POINTER_RADIUS = 190
const DIM_ALPHA = 0.08

/** Order matters: the four bands read left to right across the field. */
const DOMAIN_ORDER: DomainKey[] = ["d", "u", "i", "q"]

type Palette = Record<DomainKey, string>

type Pointer = { inside: boolean; x: number; y: number }

/** Deterministic hash without bitwise maths, in the shader tradition. */
function hash(x: number, y: number, seed: number) {
  const value = Math.sin(x * 127.1 + y * 311.7 + seed) * 43_758.5453
  return value - Math.floor(value)
}

function smooth(t: number) {
  return t * t * (3 - 2 * t)
}

/** Smooth value noise, so the mass gets organic edges instead of static. */
function noise(x: number, y: number, seed: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = smooth(x - xi)
  const yf = smooth(y - yi)
  const a = hash(xi, yi, seed)
  const b = hash(xi + 1, yi, seed)
  const c = hash(xi, yi + 1, seed)
  const d = hash(xi + 1, yi + 1, seed)
  return (a + (b - a) * xf) * (1 - yf) + (c + (d - c) * xf) * yf
}

/**
 * A broad wave whose centre line drifts across the field. Density is highest
 * along that line and decays outwards, so the mass has a solid core that
 * speckles apart at both edges rather than stopping on a hard line.
 */
function bandDensity(u: number, v: number, seed: number) {
  const centre = 0.52 - u * 0.1 + noise(u * 2.2, 3.1, seed) * 0.18
  const thickness = 0.23 + noise(u * 1.6, 7.7, seed) * 0.13
  const distance = Math.abs(v - centre) / thickness
  const core = Math.max(0, 1.12 - distance * distance * 0.92)
  // Low-frequency variation punches sparse holes through the middle.
  return core * (0.72 + noise(u * 3.5, v * 3.2, seed + 31) * 0.42)
}

function pointerBoost(pointer: Pointer, col: number, row: number) {
  if (!pointer.inside) {
    return 0
  }
  const dx = (col * STEP - pointer.x) / POINTER_RADIUS
  const dy = (row * STEP - pointer.y) / POINTER_RADIUS
  return Math.max(0, 0.7 - (dx * dx + dy * dy)) * 0.85
}

/**
 * Colour comes from soft 2D blobs with a gentle left-to-right bias, so the
 * four domains still read in order without dividing the field into stripes.
 * A fraction of cells jump to a neighbouring domain, which speckles the seams.
 */
function domainAt(
  u: number,
  v: number,
  col: number,
  row: number,
  seed: number
): DomainKey {
  const count = DOMAIN_ORDER.length
  const blob = noise(u * 2.4, v * 2.1, seed + 17)
  const t = Math.min(0.999, Math.max(0, blob * 0.42 + u * 0.62))
  let index = Math.floor(t * count)
  if (hash(col, row, seed + 5) < 0.2) {
    index += hash(row, col, seed + 9) < 0.5 ? -1 : 1
  }
  const clamped = Math.min(count - 1, Math.max(0, index))
  return DOMAIN_ORDER[clamped] as DomainKey
}

function readPalette(el: HTMLElement): Palette {
  const styles = getComputedStyle(el)
  return {
    d: styles.getPropertyValue("--zeno-data").trim(),
    i: styles.getPropertyValue("--zeno-interface").trim(),
    q: styles.getPropertyValue("--zeno-quality").trim(),
    u: styles.getPropertyValue("--zeno-users").trim(),
  }
}

type Scene = {
  height: number
  highlight: DomainKey | null
  palette: Palette
  pointer: Pointer
  seed: number
  width: number
}

function paint(context: CanvasRenderingContext2D, scene: Scene) {
  const cols = Math.ceil(scene.width / STEP)
  const rows = Math.ceil(scene.height / STEP)
  context.clearRect(0, 0, scene.width, scene.height)

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const u = col / cols
      const v = row / rows
      const density =
        bandDensity(u, v, scene.seed) + pointerBoost(scene.pointer, col, row)
      if (hash(col, row, scene.seed + 91) > density) {
        continue
      }
      const domain = domainAt(u, v, col, row, scene.seed)
      context.globalAlpha =
        scene.highlight && scene.highlight !== domain ? DIM_ALPHA : 1
      context.fillStyle = scene.palette[domain]
      context.fillRect(col * STEP, row * STEP, CELL, CELL)
    }
  }
  context.globalAlpha = 1
}

export function PixelCanvas({
  className,
  seed = SEED,
}: {
  className?: string
  seed?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerRef = useRef<Pointer>({ inside: false, x: 0, y: 0 })
  const repaintRef = useRef<(() => void) | null>(null)
  const { active } = usePixelField()
  const activeRef = useRef<DomainKey | null>(active)
  activeRef.current = active

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!(canvas && context)) {
      return
    }

    const scene: Scene = {
      height: 0,
      highlight: null,
      palette: readPalette(canvas),
      pointer: pointerRef.current,
      seed,
      width: 0,
    }
    let frame = 0

    const render = () => {
      frame = 0
      scene.highlight = activeRef.current
      scene.pointer = pointerRef.current
      paint(context, scene)
    }

    const schedule = () => {
      frame ||= requestAnimationFrame(render)
    }
    repaintRef.current = schedule

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      scene.width = rect.width
      scene.height = rect.height
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      scene.palette = readPalette(canvas)
      render()
    }

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointerRef.current = {
        inside: true,
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      }
      schedule()
    }

    const onPointerLeave = () => {
      pointerRef.current = { ...pointerRef.current, inside: false }
      schedule()
    }

    resize()
    const sizeObserver = new ResizeObserver(resize)
    sizeObserver.observe(canvas)
    const themeObserver = new MutationObserver(() => {
      scene.palette = readPalette(canvas)
      render()
    })
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    })
    canvas.addEventListener("pointermove", onPointerMove)
    canvas.addEventListener("pointerleave", onPointerLeave)

    return () => {
      repaintRef.current = null
      sizeObserver.disconnect()
      themeObserver.disconnect()
      canvas.removeEventListener("pointermove", onPointerMove)
      canvas.removeEventListener("pointerleave", onPointerLeave)
      cancelAnimationFrame(frame)
    }
  }, [seed])

  // The highlight lives in context, so a change there has to ask for a repaint.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `active` is read through a ref by the painter
  useEffect(() => {
    repaintRef.current?.()
  }, [active])

  return (
    <div aria-hidden="true" className={cn("w-full", className)}>
      <canvas className="block h-full w-full touch-none" ref={canvasRef} />
    </div>
  )
}
