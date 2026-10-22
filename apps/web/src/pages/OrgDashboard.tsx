import { Navigate } from "react-router-dom"
import { useState } from "react"
import type {
  OrganizationOverview,
  OrgActivityRow,
  OrgMemberRow,
} from "@amanak/shared-types"
import { useAsync } from "../lib/useAsync"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { KpiCard } from "../design/components/KpiCard"
import { Skeleton } from "../design/components/Skeleton"
import { ErrorState } from "../design/components/ErrorState"
import { useContext_ } from "../state/ContextProvider"
import { OrgDevicesTable } from "../components/org/OrgDevicesTable"
import { OrgIncidentsTable } from "../components/org/OrgIncidentsTable"
import { OrgMembersTable } from "../components/org/OrgMembersTable"
import { OrgActivityFeed } from "../components/org/OrgActivityFeed"
import { InviteModal } from "../components/org/InviteModal"
import { PendingInvitations } from "../components/org/PendingInvitations"

/**
 * Organization dashboard v2 (P18.2) — aggregates + data tables.
 *
 * Redirects to the personal dashboard unless an organization context is
 * active. The layout is role-gated:
 *
 * - ``owner`` / ``admin`` / ``auditor``: KPIs + devices + incidents +
 *   members + activity.
 * - ``analyst``: KPIs + devices + incidents + activity (device/incident
 *   events only; the members table is hidden).
 * - ``employee``: KPIs only.
 *
 * The backend enforces the same rules (403 on ``/activity/`` and
 * ``/members/`` for employees), so the UI merely hides what the API would
 * reject.
 */
export function OrgDashboard() {
  const t = useT()
  const { contextId, organizations } = useContext_()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [membersNonce, setMembersNonce] = useState(0)

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

  // The caller's role in the active org. Absent in most unit-test mocks, so
  // default to the least-privileged role.
  const role = (organizations ?? []).find((org) => org.id === contextId)?.role

  const canSeeMembers = role === "owner" || role === "admin" || role === "auditor"
  const canSeeActivity = role === "owner" || role === "admin" || role === "analyst" || role === "auditor"
  // Employees see KPIs only; everyone else also gets the device/incident tables.
  const canSeeTables = canSeeActivity
  // Only owner/admin may invite or remove members. Auditors get read-only.
  const canManageMembers = role === "owner" || role === "admin"
  const isOwner = role === "owner"
  const orgName = data?.organization.name ?? t("org.dashboard.title")

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

            {canSeeTables && <OrgDevicesTable devices={data.recent_devices ?? []} />}
            {canSeeTables && <OrgIncidentsTable incidents={data.recent_incidents ?? []} />}
            {canSeeMembers && (
              <OrgMembersPanel
                orgId={contextId}
                canManage={canManageMembers}
                isOwner={isOwner}
                nonce={membersNonce}
                onChanged={() => setMembersNonce((n) => n + 1)}
                onInvite={() => setInviteOpen(true)}
              />
            )}
            {canSeeMembers && canManageMembers && (
              <PendingInvitations
              orgId={contextId}
              canManage={canManageMembers}
              nonce={membersNonce}
            />
            )}
            {canSeeActivity && <OrgActivityPanel orgId={contextId} />}
          </>
        )}

        {inviteOpen && canManageMembers && (
          <InviteModal
            open={inviteOpen}
            onClose={() => setInviteOpen(false)}
            orgId={contextId}
            orgName={orgName}
            isOwner={isOwner}
            onSent={() => setMembersNonce((n) => n + 1)}
          />
        )}
      </div>
    </div>
  )
}

/** Members table, fetched lazily for owner/admin/auditor only. */
function OrgMembersPanel({
  orgId,
  canManage,
  isOwner,
  nonce,
  onChanged,
  onInvite,
}: {
  orgId: string
  canManage: boolean
  isOwner: boolean
  nonce: number
  onChanged: () => void
  onInvite: () => void
}) {
  const t = useT()
  const members = useAsync<OrgMemberRow[]>(
    () => api.listOrganizationMembers(orgId),
    [orgId, nonce],
  )

  if (members.loading) return <Skeleton height={60} />
  if (members.error && !members.loading) {
    return <ErrorState message={t("common.error")} onRetry={members.reload} />
  }
  return (
    <OrgMembersTable
      members={members.data ?? []}
      canManage={canManage}
      isOwner={isOwner}
      orgId={orgId}
      onChanged={onChanged}
      onInvite={canManage ? onInvite : undefined}
    />
  )
}

/** Role-filtered activity feed, fetched lazily for non-employees. */
function OrgActivityPanel({ orgId }: { orgId: string }) {
  const t = useT()
  const activity = useAsync<OrgActivityRow[]>(
    () => api.listOrganizationActivity(orgId, 10),
    [orgId],
  )

  if (activity.loading) return <Skeleton height={60} />
  if (activity.error && !activity.loading) {
    return <ErrorState message={t("common.error")} onRetry={activity.reload} />
  }
  return <OrgActivityFeed activity={activity.data ?? []} />
}
