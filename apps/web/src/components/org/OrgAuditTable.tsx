import { useState } from "react"
import { useT } from "../../design/i18n"
import type { OrgAuditEntry } from "@amanak/shared-types"

export function OrgAuditTable({ rows }: { rows: OrgAuditEntry[] }) {
  const t = useT()
  const [expanded, setExpanded] = useState<number | null>(null)

  if (rows.length === 0) {
    return <div className="amk-org-table__empty">{t("org.audit.empty")}</div>
  }

  return (
    <div className="amk-org-table">
      {rows.map((r) => (
        <div className="amk-org-table__row" key={r.id}>
          <div className="amk-org-table__main">
            <div className="amk-org-table__title">
              {new Date(r.created_at).toLocaleString()}
            </div>
            <div className="amk-org-table__meta">
              {r.actor ? r.actor.email : "—"} · {t(`org.audit.action.${r.action}`) || r.action} · {r.target_email || r.target_id || "—"}
            </div>
          </div>
          <button
            onClick={() => setExpanded(expanded === r.id ? null : r.id)}
            aria-label={expanded === r.id ? t("org.audit.details.hide") : t("org.audit.details.show")}
          >
            {expanded === r.id ? t("org.audit.details.hide") : t("org.audit.details.show")}
          </button>
          {expanded === r.id && (
            <div className="amk-org-audit__details">
              <div>{t("org.audit.col.ip")}: {r.ip ?? "—"}</div>
              <div>User agent: { (r as any).user_agent ?? "—"}</div>
              <pre>{JSON.stringify(r.metadata, null, 2)}</pre>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
