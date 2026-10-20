import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { api } from "../lib/api"
import { setContextId } from "@amanak/api-client"
import { loadStore, readStoreSync, writeStore } from "./storage"
import { useAuth } from "../state/AuthContext"
import type { Organization } from "@amanak/shared-types"

/**
 * Active tenant context (P18.1c2).
 *
 * Mirrors `apps/web/src/state/ContextProvider.tsx`: `null` is the personal
 * context, the choice is persisted (SecureStore on device, localStorage on
 * web) and a stale id falls back to personal.
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

export function ContextProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [contextId, setContextIdState] = useState<string | null>(() => readStoreSync(STORAGE_KEY))
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setContextId(contextId)
  }, [contextId])

  useEffect(() => {
    void loadStore(STORAGE_KEY).then((value) => {
      if (value) setContextIdState(value)
    })
  }, [])

  const load = useCallback(async () => {
    if (!user) {
      setOrganizations([])
      return
    }
    setLoading(true)
    try {
      const orgs = await api.listOrganizations()
      setOrganizations(orgs)
      setContextIdState((current) => {
        if (current && !orgs.some((org) => org.id === current)) {
          void writeStore(STORAGE_KEY, "")
          return null
        }
        return current
      })
    } catch {
      setOrganizations([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    void load()
  }, [load])

  const switchContext = useCallback((orgId: string | null) => {
    void writeStore(STORAGE_KEY, orgId ?? "")
    setContextId(orgId)
    setContextIdState(orgId)
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
