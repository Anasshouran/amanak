import { Navigate } from "react-router-dom"
import { useState } from "react"
import type { OrgAuditEntry, OrgAuditResponse } from "@amanak/shared-types"
import { useAsync } from "../lib/useAsync"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { Skeleton } from "../design/components/Skeleton"
import { ErrorState } from "../design/components/ErrorState"
import { useContext_ } from "../state/ContextProvider"
import { OrgAuditTable } from "../components/org/OrgAuditTable"
import { OrgAuditFilters } from "../components/org/OrgAuditFilters"

export function OrgAudit() {
  const t = useT()
  const { contextId, organizations } = useContext_()
  const [action, setAction] = useState("")
  const [actor, setActor] = useState("")
  const [nonce, setNonce] = useState(0)

  const role = (organizations ?? []).find((org) => org.id === contextId)?.role
  const allowed = role === "owner" || role === "admin" || role === "auditor"

  const data = useAsync<OrgAuditResponse>(
    () =>
      contextId
        ? api.listOrgAudit(contextId, { action: action || undefined, actor: actor || undefined, limit: 50 })
        : Promise.resolve({ count: 0, results: [] }),
    [contextId, action, actor, nonce],
  )

  if (!contextId) return <Navigate to="/dashboard" replace />
  if (!allowed && organizations && organizations.length) return <Navigate to="/org" replace />

  const rows: OrgAuditEntry[] = data.data?.results ?? []

  return (
    <div className="amk-page">
      <div className="amk-card amk-card--padded">
        <h1>{t("org.audit.title")}</h1>
        <p>{t("org.audit.subtitle")}</p>
        <OrgAuditFilters action={action} actor={actor} onActionChange={setAction} onActorChange={setActor} />
        {data.loading && <Skeleton height={80} />}
        {Boolean(data.error) && !data.loading && <ErrorState title={t("common.error")} onRetry={data.reload} />}
        {!data.loading && !data.error && <OrgAuditTable rows={rows} />}
      </div>
    </div>
  )
}
