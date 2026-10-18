import { useEffect, useRef, useState } from "react"
import { Text, View } from "react-native"
import { useTokens } from "../../design/tokens"

const DEFAULT_DURATION_MS = 10_000

export type RevealTimerMobileProps = {
  /** Whether the timer is currently counting down. */
  active: boolean
  /** Milliseconds to count down from. Defaults to 10 s. */
  durationMs?: number
  /** Fired when the timer reaches zero (consumer should re-mask). */
  onExpire: () => void
}

/**
 * Plaintext reveal countdown (web `RevealTimer` parity).
 *
 * Uses an absolute end timestamp so drift is bounded, ticks at 250 ms for a
 * smooth second-by-second display, and always clears its interval on unmount
 * or when deactivated — a revealed password is never left counting in memory.
 */
export function RevealTimerMobile({
  active,
  durationMs = DEFAULT_DURATION_MS,
  onExpire,
}: RevealTimerMobileProps) {
  const tokens = useTokens()
  const [remaining, setRemaining] = useState(durationMs)
  const endAtRef = useRef<number>(0)
  const expiredRef = useRef(false)

  useEffect(() => {
    if (!active) return
    expiredRef.current = false
    endAtRef.current = Date.now() + durationMs
    setRemaining(durationMs)
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
    const id = setInterval(tick, 250)
    return () => {
      clearInterval(id)
    }
  }, [active, durationMs, onExpire])

  if (!active) return null

  const seconds = Math.ceil(remaining / 1000)
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.space[1] }}>
      <Text
        style={{
          color: tokens.c.muted,
          fontSize: tokens.size.xs,
          fontFamily: tokens.font.mono,
          writingDirection: "ltr",
        }}
      >
        {seconds}s
      </Text>
    </View>
  )
}
