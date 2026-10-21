import { useT } from "../../design/i18n"
import type { OrgMemberRow } from "@amanak/shared-types"

/**
 * Organization members (P18.2).
 *
 * Role-gated: ``canView`` is false for roles that may not list members
 * (analyst / employee). The backend returns 403 for those roles, so the
 * component renders nothing rather than an empty table.
 */
export function OrgMembersTable({
  members,
  canView = true,
}: {
  members: OrgMemberRow[]
  canView?: boolean
}) {
  const t = useT()
  if (!canView) return null
  return (
    <section className="amk-org-section">
      <div className="amk-org-section__header">
        <h2 className="amk-org-section__title">{t("org.dashboard.members")}</h2>
      </div>
      <div className="amk-org-table">
        {members.length === 0 ? (
          <div className="amk-org-table__empty">—</div>
        ) : (
          members.map((m) => (
            <div className="amk-org-table__row" key={m.user_id}>
              <div className="amk-org-table__main">
                <div className="amk-org-table__title">{m.display_name || m.email}</div>
                <div className="amk-org-table__meta">
                  {t(`org.members.role.${m.role}`)}
                </div>
              </div>
              <div className="amk-org-table__time">
                {t("org.members.last_active")}:{" "}
                {m.last_active_at
                  ? new Date(m.last_active_at).toLocaleString()
                  : "—"}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
