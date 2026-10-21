import { useT } from "../../design/i18n"
import type { OrgIncidentSummary } from "@amanak/shared-types"

const severityColor: Record<string, string> = {
  critical: "#ef4444",
  high: "#f59e0b",
  medium: "#eab308",
  low: "#22c55e",
}

/**
 * Recent org incidents (P18.2). The severity is shown as a coloured dot; the
 * "View all" link is a plain anchor so the component renders without a router.
 */
export function OrgIncidentsTable({
  incidents,
}: {
  incidents: OrgIncidentSummary[]
}) {
  const t = useT()
  return (
    <section className="amk-org-section">
      <div className="amk-org-section__header">
        <h2 className="amk-org-section__title">
          {t("org.dashboard.recent_incidents")}
        </h2>
        <a className="amk-org-section__link" href="/incidents">
          {t("org.dashboard.view_all")} →
        </a>
      </div>
      <div className="amk-org-table">
        {incidents.length === 0 ? (
          <div className="amk-org-table__empty">—</div>
        ) : (
          incidents.map((i) => (
            <div className="amk-org-table__row" key={i.id}>
              <div className="amk-org-table__main">
                <div className="amk-org-table__title">
                  <span
                    className="amk-org-dot"
                    style={{ backgroundColor: severityColor[i.severity] || "#9ca3af" }}
                  />
                  {i.title}
                </div>
                <div className="amk-org-table__meta">
                  {i.severity} · {i.status}
                </div>
              </div>
              <div className="amk-org-table__time">
                {i.created_at ? new Date(i.created_at).toLocaleString() : "—"}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
