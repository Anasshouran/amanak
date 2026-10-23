import { useState } from "react"
import { useT } from "../../design/i18n"

const ACTIONS = [
  "org.created",
  "org.updated",
  "org.deleted",
  "member.invited",
  "member.joined",
  "member.role_changed",
  "member.removed",
  "member.declined",
  "device.added",
  "device.removed",
  "incident.created",
  "incident.resolved",
  "sharing.changed",
]

export function OrgAuditFilters({
  action,
  actor,
  onActionChange,
  onActorChange,
}: {
  action: string
  actor: string
  onActionChange: (v: string) => void
  onActorChange: (v: string) => void
}) {
  const t = useT()
  return (
    <div className="amk-org-audit-filters">
      <select
        aria-label={t("org.audit.filter.action")}
        value={action}
        onChange={(e) => onActionChange(e.target.value)}
      >
        <option value="">{t("org.audit.filter.all_actions")}</option>
        {ACTIONS.map((a) => (
          <option key={a} value={a}>
            {t(`org.audit.action.${a}`) || a}
          </option>
        ))}
      </select>
      <input
        aria-label={t("org.audit.filter.actor")}
        placeholder={t("org.audit.filter.actor")}
        value={actor}
        onChange={(e) => onActorChange(e.target.value)}
      />
    </div>
  )
}
