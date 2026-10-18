import { useEffect, useState } from "react"
import { AccessibilityInfo } from "react-native"

/**
 * Tracks the OS "reduce motion" setting.
 *
 * Layout animations consult this so they can collapse to an instant state
 * change instead of sliding.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let mounted = true

    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value)
      })
      .catch(() => undefined)

    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced)

    return () => {
      mounted = false
      subscription.remove()
    }
  }, [])

  return reduced
}
