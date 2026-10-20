import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { api, setContextId } from "../lib/api"
import { useAuth } from "./AuthContext"
import type { Organization } from "@amanak/shared-types"

/**
 * Active tenant context (P18.1c2).
 *
 * `contextId === null` means the personal context. The selection is persisted
 * in ``localStorage`` and mirrored across tabs via the ``storage`` event.
 * Switching reloads the page — the simplest correct invalidation for this
 * phase (every cached query would otherwise need manual clearing).
 */
const STORAGE_KEY = "amanak.context"

type ContextState = {
  contextId: string | null
  contextName: string
  organizations: Organization[]
  loading: boolean
  switchContext: (orgId: string | null) => void
}

const ContextContext = createContext<ContextState | undefined>(undefined)

function readStored(): string | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value ? value : null
  } catch {
    return null
  }
}

export function ContextProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [contextId, setContextIdState] = useState<string | null>(() => readStored())
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)

  // Publish the active context to the API client so every request carries it.
  // (Initial value already published by lib/api.ts at module load.)
  useEffect(() => {
    setContextId(contextId)
  }, [contextId])

  // Load the caller's organizations, then validate any stored context against
  // the FRESHLY-FETCHED list (not the closure's stale `organizations`). A
  // stale id (left org / deleted) falls back to personal.
  const load = useCallback(async () => {
    if (!user) {
      setOrganizations([])
      return
    }
    setLoading(true)
    const storedId = readStored()
    try {
      const orgs = await api.listOrganizations()
      const validId =
        storedId && orgs.some((org) => org.id === storedId) ? storedId : null
      setOrganizations(orgs)
      setContextIdState(validId)
      setContextId(validId)
      if (validId !== storedId) {
        try {
          if (validId) window.localStorage.setItem(STORAGE_KEY, validId)
          else window.localStorage.removeItem(STORAGE_KEY)
        } catch {
          /* storage unavailable */
        }
      }
    } catch {
      setOrganizations([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  // Keep tabs in sync: another tab switching context updates this one too.
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key !== STORAGE_KEY) return
      setContextIdState(event.newValue ? event.newValue : null)
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const switchContext = useCallback((orgId: string | null) => {
    try {
      if (orgId) window.localStorage.setItem(STORAGE_KEY, orgId)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable */
    }
    setContextId(orgId)
    // Intentional full reload: guarantees a clean cache for the new tenant.
    window.location.reload()
  }, [])

  const contextName = useMemo(() => {
    if (!contextId) return "Personal"
    return organizations.find((org) => org.id === contextId)?.name ?? "Personal"
  }, [contextId, organizations])

  const value = useMemo(
    () => ({ contextId, contextName, organizations, loading, switchContext }),
    [contextId, contextName, organizations, loading, switchContext],
  )

  return <ContextContext.Provider value={value}>{children}</ContextContext.Provider>
}

export function useContext_(): ContextState {
  const ctx = useContext(ContextContext)
  if (!ctx) throw new Error("useContext_ must be used within ContextProvider")
  return ctx
}
