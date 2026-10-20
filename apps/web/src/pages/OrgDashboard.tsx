import { Navigate } from "react-router-dom"
import type { OrganizationOverview } from "@amanak/shared-types"
import { useAsync } from "../lib/useAsync"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { KpiCard } from "../design/components/KpiCard"
import { Skeleton } from "../design/components/Skeleton"
import { ErrorState } from "../design/components/ErrorState"
import { useContext_ } from "../state/ContextProvider"

/**
 * Organization dashboard v1 (P18.1c2) — aggregates only.
 *
 * Redirects to the personal dashboard unless an organization context is active.
 * Full data tables, member management and the incident workflow arrive in
 * P18.2 / P18.3.
 */
export function OrgDashboard() {
  const t = useT()
  const { contextId } = useContext_()
  const overview = useAsync<OrganizationOverview>(
    () =>
      contextId
        ? api.getOrganizationOverview(contextId)
        : Promise.resolve(null as unknown as OrganizationOverview),
    [contextId],
  )

  if (!contextId) {
    return <Navigate to="/dashboard" replace />
  }

  const data = overview.data

  return (
    <div className="amk-page">
      <div className="amk-card amk-card--padded org-dashboard">
        <div className="org-dashboard__head">
          <h1 className="org-dashboard__title">{data?.organization.name ?? t("org.dashboard.title")}</h1>
          {data && (
            <p className="org-dashboard__subtitle">
              {t("org.dashboard.members")}: {data.member_count} ·{" "}
              {t("org.dashboard.devices")}: {data.device_count} ·{" "}
              {t("org.dashboard.incidents")}: {data.open_incident_count}
            </p>
          )}
        </div>

        {overview.loading && <Skeleton height={80} />}
        {overview.error && !overview.loading && (
          <ErrorState message={t("common.error")} onRetry={overview.reload} />
        )}

        {data && !overview.loading && (
          <>
            <div className="org-dashboard__kpis">
              <KpiCard label={t("org.dashboard.members")} value={data.member_count} />
              <KpiCard label={t("org.dashboard.devices")} value={data.device_count} />
              <KpiCard label={t("org.dashboard.incidents")} value={data.open_incident_count} />
              <KpiCard label={t("org.dashboard.score")} value={data.security_score} />
            </div>
            <div className="org-dashboard__coming">
              <strong>{t("org.dashboard.coming_soon")}</strong>
              <ul>
                <li>{t("org.dashboard.coming.members")}</li>
                <li>{t("org.dashboard.coming.incidents")}</li>
                <li>{t("org.dashboard.coming.reports")}</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
