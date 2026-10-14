import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Button } from "../design/components"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import {
  clearImpersonation,
  getImpersonation,
  remainingSeconds,
  subscribeImpersonation,
  type Impersonation,
} from "../lib/impersonation"

function formatClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

export function ImpersonationBanner() {
  const t = useT()
  const navigate = useNavigate()
  const [state, setState] = useState<Impersonation | null>(() => getImpersonation())
  const [seconds, setSeconds] = useState(() => {
    const current = getImpersonation()
    return current ? remainingSeconds(current) : 0
  })

  useEffect(() => {
    const sync = () => {
      const current = getImpersonation()
      setState(current)
      setSeconds(current ? remainingSeconds(current) : 0)
    }
    const unsubscribe = subscribeImpersonation(sync)
    const timer = window.setInterval(sync, 1000)
    return () => {
      unsubscribe()
      window.clearInterval(timer)
    }
  }, [])

  const end = useCallback(async () => {
    const current = getImpersonation()
    clearImpersonation()
    navigate("/staff")
    if (current) {
      try {
        await api.endImpersonation(current.sessionId)
      } catch {
        // The session may already have expired server-side; nothing to do.
      }
    }
  }, [navigate])

  useEffect(() => {
    if (state && seconds <= 0) {
      void end()
    }
  }, [state, seconds, end])

  if (!state) return null

  return (
    <div className="amk-impersonation" role="status" aria-live="polite">
      <span className="amk-impersonation__dot" aria-hidden="true" />
      <span className="amk-impersonation__text">
        {t("staff.impersonate.banner", { email: state.email, time: formatClock(seconds) })}
      </span>
      <Button variant="ghost" size="sm" onClick={() => void end()}>
        {t("staff.impersonate.end")}
      </Button>
    </div>
  )
}
