import { useT } from "../../design/i18n"
import type { OrgActivityRow } from "@amanak/shared-types"

const icon: Record<string, string> = {
  incident_created: "🔴",
  device_added: "📱",
  member_joined: "👤",
}

/**
 * Role-filtered merged activity (P18.2).
 *
 * Rows arrive already filtered by the backend for the caller's role; the
 * component only renders. The ``type`` maps to an i18n label and an icon.
 */
export function OrgActivityFeed({ activity }: { activity: OrgActivityRow[] }) {
  const t = useT()
  return (
    <section className="amk-org-section">
      <div className="amk-org-section__header">
        <h2 className="amk-org-section__title">
          {t("org.dashboard.recent_activity")}
        </h2>
      </div>
      <div className="amk-org-table">
        {!activity || activity.length === 0 ? (
          <div className="amk-org-table__empty">{t("org.activity.empty")}</div>
        ) : (
          activity.map((a, idx) => (
            <div className="amk-org-table__row" key={`${a.type}-${idx}`}>
              <div className="amk-org-table__main">
                <div className="amk-org-table__title">
                  {icon[a.type] || "•"} {t(`org.activity.${a.type}`)}: {a.title}
                </div>
                {a.actor_email && (
                  <div className="amk-org-table__meta">{a.actor_email}</div>
                )}
              </div>
              <div className="amk-org-table__time">
                {a.created_at ? new Date(a.created_at).toLocaleString() : "—"}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
