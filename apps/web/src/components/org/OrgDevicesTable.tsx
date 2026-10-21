import { useT } from "../../design/i18n"
import type { OrgDeviceSummary } from "@amanak/shared-types"

/**
 * Recent org devices (P18.2).
 *
 * Uses a plain anchor rather than react-router's ``Link`` so the component
 * renders standalone (and in isolation tests) without a router context.
 */
export function OrgDevicesTable({ devices }: { devices: OrgDeviceSummary[] }) {
  const t = useT()
  return (
    <section className="amk-org-section">
      <div className="amk-org-section__header">
        <h2 className="amk-org-section__title">
          {t("org.dashboard.recent_devices")}
        </h2>
        <a className="amk-org-section__link" href="/devices">
          {t("org.dashboard.view_all")} →
        </a>
      </div>
      <div className="amk-org-table">
        {devices.length === 0 ? (
          <div className="amk-org-table__empty">—</div>
        ) : (
          devices.map((d) => (
            <div className="amk-org-table__row" key={d.id}>
              <div className="amk-org-table__main">
                <div className="amk-org-table__title">{d.name || "—"}</div>
                <div className="amk-org-table__meta">
                  {d.os} · {d.type}
                </div>
              </div>
              <div className="amk-org-table__time">
                {d.last_seen ? new Date(d.last_seen).toLocaleString() : "—"}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
