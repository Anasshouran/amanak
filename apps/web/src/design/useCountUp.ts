import { useEffect, useRef, useState } from "react"

/**
 * Animates a number from a starting point to `target` using rAF.
 * Honours `prefers-reduced-motion` (snaps straight to the target).
 */
export function useCountUp(target: number, durationMs = 400, fromZero = true): number {
  const [value, setValue] = useState(() => (fromZero ? 0 : target))
  const previous = useRef(fromZero ? 0 : target)
  const frame = useRef<number | null>(null)

  useEffect(() => {
    const from = previous.current
    const to = target
    if (from === to) {
      setValue(to)
      return
    }
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (reduce || typeof requestAnimationFrame !== "function") {
      previous.current = to
      setValue(to)
      return
    }
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      const next = Math.round(from + (to - from) * eased)
      setValue(next)
      if (t < 1) {
        frame.current = requestAnimationFrame(step)
      } else {
        previous.current = to
      }
    }
    frame.current = requestAnimationFrame(step)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [target, durationMs])

  return value
}
