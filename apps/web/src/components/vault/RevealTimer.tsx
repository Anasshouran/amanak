import { useEffect, useRef, useState } from "react"

export type RevealTimerProps = {
  active: boolean
  durationMs?: number
  onExpire: () => void
}

const DEFAULT_DURATION = 10_000

export function RevealTimer({ active, durationMs = DEFAULT_DURATION, onExpire }: RevealTimerProps) {
  const [remaining, setRemaining] = useState(durationMs)
  const endAtRef = useRef<number>(0)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (active) {
      expiredRef.current = false
      endAtRef.current = Date.now() + durationMs
      setRemaining(durationMs)
      return () => {
        // cleanup handled in next run; also on unmount
      }
    }
    return undefined
  }, [active, durationMs])

  useEffect(() => {
    if (!active) return
    const tick = () => {
      const now = Date.now()
      const rem = Math.max(0, endAtRef.current - now)
      setRemaining(rem)
      if (rem === 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire()
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => {
      window.clearInterval(id)
    }
  }, [active, onExpire])

  if (!active) return null
  const seconds = Math.ceil(remaining / 1000)
  return <span data-testid="reveal-timer" aria-live="polite">{seconds}s</span>
}

export function useRevealTimer(active: boolean, durationMs = DEFAULT_DURATION, onExpire: () => void) {
  const [remainingMs, setRemainingMs] = useState(durationMs)
  const endAtRef = useRef<number>(0)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (!active) {
      expiredRef.current = false
      return
    }
    expiredRef.current = false
    endAtRef.current = Date.now() + durationMs
    setRemainingMs(durationMs)
  }, [active, durationMs])

  useEffect(() => {
    if (!active) return
    const tick = () => {
      const now = Date.now()
      const rem = Math.max(0, endAtRef.current - now)
      setRemainingMs(rem)
      if (rem === 0 && !expiredRef.current) {
        expiredRef.current = true
        onExpire()
      }
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => {
      window.clearInterval(id)
    }
  }, [active, onExpire])

  return Math.ceil(remainingMs / 1000)
}
