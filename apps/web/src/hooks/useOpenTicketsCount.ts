import { useEffect, useState } from "react"
import type { User } from "@amanak/shared-types"
import { api } from "../lib/api"
import { canManageTickets } from "../lib/staff"

const REFRESH_MS = 60_000

/**
 * Open-ticket count for the staff navigation badge.
 *
 * Fetches once on mount and then every 60 seconds while the tab is visible.
 * The tickets endpoint does not support a count-only query, so we read
 * `count` from the first page of an `open`-status listing.
 */
export function useOpenTicketsCount(user: User | null | undefined): number {
  const userId = user?.id
  const allowed = userId != null && canManageTickets(user)
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!allowed) {
      setCount(0)
      return
    }

    let cancelled = false
    const load = async () => {
      try {
        const page = await api.listTickets({ status: "open", page: 1 })
        if (!cancelled) setCount(page.count ?? 0)
      } catch {
        /* Badge is best-effort; ignore transient errors. */
      }
    }

    void load()

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load()
    }, REFRESH_MS)

    const onVisibility = () => {
      if (document.visibilityState === "visible") void load()
    }
    document.addEventListener("visibilitychange", onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", onVisibility)
    }
  }, [allowed])

  return count
}
