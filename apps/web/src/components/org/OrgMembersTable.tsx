import { useState } from "react"
import { useT } from "../../design/i18n"
import type { OrgMemberRow } from "@amanak/shared-types"
import { api } from "../../lib/api"

const ASSIGNABLE = ["owner", "admin", "analyst", "employee", "auditor"] as const

/**
 * Organization members (P18.3).
 *
 * Interactive for owners/admins:
 * - role dropdown is owner-only (admins may remove but not change roles),
 * - the last owner can neither be demoted nor removed,
 * - removal asks for confirmation first.
 *
 * ``canView`` is false for roles that may not list members
 * (analyst / employee). The backend returns 403 for those roles, so the
 * component renders nothing rather than an empty table.
 */
export function OrgMembersTable({
  members,
  canView = true,
  canManage = false,
  isOwner = false,
  orgId = "",
  onChanged,
  onInvite,
}: {
  members: OrgMemberRow[]
  canView?: boolean
  canManage?: boolean
  isOwner?: boolean
  orgId?: string
  onChanged?: () => void
  /** When provided, an "Invite" action is rendered in the section header. */
  onInvite?: () => void
}) {
  const t = useT()
  const [confirming, setConfirming] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (!canView) return null

  const ownerCount = members.filter((m) => m.role === "owner").length
  const isLastOwner = (m: OrgMemberRow) => m.role === "owner" && ownerCount <= 1

  async function changeRole(m: OrgMemberRow, role: string) {
    setBusy(true)
    setError("")
    try {
      await api.patch(`/organizations/${orgId}/members/${m.user_id}/`, { role })
      onChanged?.()
    } catch (e: any) {
      setError(e?.response?.data?.message || t("common.error"))
    } finally {
      setBusy(false)
    }
  }

  async function remove(m: OrgMemberRow) {
    setBusy(true)
    setError("")
    try {
      await api.delete(`/organizations/${orgId}/members/${m.user_id}/`)
      setConfirming(null)
      onChanged?.()
    } catch (e: any) {
      setError(e?.response?.data?.message || t("common.error"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="amk-org-section">
      <div className="amk-org-section__header">
        <h2 className="amk-org-section__title">{t("org.dashboard.members")}</h2>
        {onInvite && (
          <button className="amk-org-section__link" onClick={onInvite}>
            + {t("org.members.invite")}
          </button>
        )}
      </div>
      {error && <div className="amk-org-table__empty">{error}</div>}
      <div className="amk-org-table">
        {members.length === 0 ? (
          <div className="amk-org-table__empty">—</div>
        ) : (
          members.map((m) => (
            <div className="amk-org-table__row" key={m.user_id}>
              <div className="amk-org-table__main">
                <div className="amk-org-table__title">{m.display_name || m.email}</div>
                <div className="amk-org-table__meta">
                  {isOwner ? (
                    <select
                      aria-label={t("org.members.change_role")}
                      value={m.role}
                      disabled={busy || isLastOwner(m)}
                      title={isLastOwner(m) ? t("org.members.cannot_demote_last_owner") : undefined}
                      onChange={(e) => changeRole(m, e.target.value)}
                    >
                      {ASSIGNABLE.map((r) => (
                        <option key={r} value={r}>
                          {t(`org.members.role.${r}`) || r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span>{t(`org.members.role.${m.role}`) || m.role}</span>
                  )}
                </div>
              </div>
              <div className="amk-org-table__time">
                {t("org.members.last_active")}:{" "}
                {m.last_active_at ? new Date(m.last_active_at).toLocaleString() : "—"}
              </div>
              {canManage && !isLastOwner(m) && (
                <div className="amk-org-table__actions">
                  {confirming === m.user_id ? (
                    <>
                      <button
                        onClick={() => remove(m)}
                        disabled={busy}
                        title={t("org.members.remove_confirm_body")}
                      >
                        {t("org.members.remove_confirm_title")}
                      </button>
                      <button onClick={() => setConfirming(null)} disabled={busy}>
                        {t("common.cancel")}
                      </button>
                    </>
                  ) : (
                    <button onClick={() => setConfirming(m.user_id)} disabled={busy}>
                      {t("org.members.remove")}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  )
}
