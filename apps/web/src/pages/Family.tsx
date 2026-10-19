import type { FamilyMemberSummary, FamilyMe, FamilyInvitation } from "@amanak/shared-types"
import { useCallback, useEffect, useState } from "react"
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  Skeleton,
} from "../design/components"
import { IconFamily, IconPlus, IconTrash } from "../design/icons"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"

export function Family() {
  const t = useT()
  const family = useAsync(() => api.getFamily())
  const members = useAsync(() => api.listMembers())
  const meData = useAsync(() => api.getMe())
  const invitations = useAsync(() => api.listInvitations())
  const [email, setEmail] = useState("")
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deletePwd, setDeletePwd] = useState("")
  const [leaving, setLeaving] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<number | null>(null)
  const [joinOpen, setJoinOpen] = useState(false)
  const [joinToken, setJoinToken] = useState("")
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const is404 = (family.error as { status?: number } | null)?.status === 404
  const noFamily = !family.data && (!family.error || is404)
  const realError = !!family.error && !is404

  async function onCreate() {
    if (!family.data && members.data) {
      setCreating(true)
      try {
        await api.createFamily("My Family")
        await family.reload()
        await members.reload()
      } catch (e) {
        // handled by error display
      } finally {
        setCreating(false)
      }
    }
  }

  async function onJoin() {
    if (!joinToken.trim()) return
    setJoining(true)
    setJoinError(null)
    try {
      await api.acceptInvitation({ token: joinToken.trim() })
      setJoinOpen(false)
      setJoinToken("")
      await family.reload()
      await members.reload()
      await meData.reload()
    } catch (e: unknown) {
      setJoinError(errorMessage(e, t("common.error")))
    } finally {
      setJoining(false)
    }
  }

  async function onInvite() {
    if (!email.trim()) return
    setInviting(true)
    try {
      await api.createInvitation({ invited_email: email.trim() })
      setEmail("")
      await invitations.reload()
    } catch (e: unknown) {
      // handled by error
    } finally {
      setInviting(false)
    }
  }

  async function onDelete() {
    setLeaving(true)
    try {
      await api.deleteFamily(deletePwd)
      await family.reload()
    } catch (e) {
      // handled
    } finally {
      setLeaving(false)
      setDeletePwd("")
      setDeleteOpen(false)
    }
  }

  async function onLeave() {
    if (!meData.data || meData.data.role === "guardian") {
      setDeleteOpen(true)
      return
    }
    setLeaving(true)
    try {
      await api.removeMember(meData.data.user_id)
      await family.reload()
      await members.reload()
    } catch (e: unknown) {
      // handled
    } finally {
      setLeaving(false)
    }
  }

  const refresh = useCallback(async () => {
    await family.reload()
    await members.reload()
    await meData.reload()
  }, [family, members, meData])

  if (family.loading) {
    return (
      <div className="amk-page">
        <h1>{t("family.title")}</h1>
        <Skeleton height={120} />
      </div>
    )
  }

  if (noFamily) {
    return (
      <div className="amk-page">
        <div className="amk-page-head">
          <div>
            <h1>{t("family.title")}</h1>
            <p>{t("family.subtitle")}</p>
          </div>
        </div>
        <Card padded elevated>
          <EmptyState
            icon={<IconFamily size={36} />}
            title={t("family.empty.title")}
            description={t("family.empty.subtitle")}
          />
          <div className="amk-row" style={{ gap: "var(--space-2)", justifyContent: "center" }}>
            <Button loading={creating} onClick={() => void onCreate()}>
              {t("family.empty.create")}
            </Button>
            <Button variant="secondary" onClick={() => { setJoinOpen(true); setJoinError(null) }}>
              {t("family.empty.join")}
            </Button>
          </div>
        </Card>

        <Modal
          open={joinOpen}
          onClose={() => { setJoinOpen(false); setJoinToken(""); setJoinError(null) }}
          title={t("family.empty.join")}
          actions={
            <>
              <Button variant="ghost" onClick={() => { setJoinOpen(false); setJoinToken(""); setJoinError(null) }}>{t("actions.cancel")}</Button>
              <Button onClick={() => void onJoin()} loading={joining}>{t("family.empty.join")}</Button>
            </>
          }
        >
          <div className="amk-stack">
            <Input label={t("family.setup.email")} value={joinToken} onChange={(e) => setJoinToken(e.target.value)} />
            {joinError && <p className="amk-muted">{joinError}</p>}
          </div>
        </Modal>
      </div>
    )
  }

  if (realError) {
    return (
      <div className="amk-page">
        <h1>{t("family.title")}</h1>
        <EmptyState icon={<IconFamily size={36} />} title={t("common.error")} description={errorMessage(family.error, t("common.error"))} />
      </div>
    )
  }

  const familyRow = family.data as { id: number; name: string; guardian: { user_id: number; display_name: string }; role: string }
  const memberRows = (members.data ?? []) as FamilyMemberSummary[]
  const ownRow = memberRows.find((m) => m.user_id === (familyRow?.guardian?.user_id ?? -1)) || memberRows[0]
  const me = meData.data

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("family.title")}</h1>
          <p>{t("family.subtitle")}</p>
        </div>
        <div className="amk-row">
          <Button variant="danger" onClick={() => void onLeave()} loading={leaving}>
            {ownRow?.role === "guardian" ? t("family.setup.delete") : t("family.setup.leave")}
          </Button>
        </div>
      </div>

      {/* Member list */}
      <Card padded elevated title={t("family.setup.memberList")}>
        {members.loading ? (
          <Skeleton height={48} />
        ) : members.error ? (
          <p className="amk-muted">{t("common.error")}</p>
        ) : memberRows.length === 0 ? (
          <EmptyState icon={<IconFamily size={30} />} title={t("family.setup.empty") || "No members"} />
        ) : (
          <ul className="amk-list">
            {memberRows.map((m: FamilyMemberSummary) => (
              <li key={m.user_id} className="amk-listitem">
                <div style={{ display: "grid", gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{m.display_name}</span>
                  <span className="amk-muted">
                    {m.role === "guardian" ? (t("nav.family") || "Guardian") : (t("family.setup.member") || "Member")}
                    {` · ${t("common.score")}: ${m.security_score}`}
                  </span>
                </div>
                <Badge variant={m.role === "guardian" ? "success" : "neutral"}>{t("family.setup.score")}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Sharing toggles (self) */}
      {me && (
        <Card padded elevated title={t("family.toggles.title")}>
          <p className="amk-muted">{t("family.toggles.desc")}</p>
          <div className="amk-stack">
            <label className="amk-check">
              <input type="checkbox" checked={!!me.share_incidents} onChange={() => api.updateMe({ share_incidents: !me.share_incidents }).then(async () => await refresh())} />
              <span>{t("family.toggles.incidents")}</span>
            </label>
            <label className="amk-check">
              <input type="checkbox" checked={!!me.share_devices} onChange={() => api.updateMe({ share_devices: !me.share_devices }).then(async () => await refresh())} />
              <span>{t("family.toggles.devices")}</span>
            </label>
            <label className="amk-check">
              <input type="checkbox" checked={!!me.share_breach} onChange={() => api.updateMe({ share_breach: !me.share_breach }).then(async () => await refresh())} />
              <span>{t("family.toggles.breach")}</span>
            </label>
            <label className="amk-check">
              <input type="checkbox" checked={!!me.share_scans} onChange={() => api.updateMe({ share_scans: !me.share_scans }).then(async () => await refresh())} />
              <span>{t("family.toggles.scans")}</span>
            </label>
          </div>
        </Card>
      )}

      {/* Invitations */}
      <Card padded elevated title={t("family.setup.pendingInvites")}>
        <form className="amk-stack" onSubmit={(e) => { e.preventDefault(); void onInvite() }} noValidate>
          <Input label={t("family.setup.email")} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button icon={<IconPlus size={16} />} loading={inviting} disabled={!email.trim()} type="submit">{t("family.setup.sendInvite")}</Button>
        </form>
        {invitations.loading ? (
          <Skeleton height={48} />
        ) : invitations.error ? (
          <p className="amk-muted">{t("common.error")}</p>
        ) : (invitations.data && invitations.data.length > 0 ? (
          <ul className="amk-list">
            {(invitations.data as FamilyInvitation[]).map((inv) => (
              <li key={inv.id} className="amk-listitem">
                <span>{inv.invited_email}</span>
                <span className="amk-muted">{new Date(inv.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<IconFamily size={30} />} title={t("family.setup.emptyInvites") || "No pending invites"} />
        ))}
      </Card>

      {/* Delete / Leave */}
      <Modal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeletePwd("") }}
        title={ownRow?.role === "guardian" ? t("family.setup.confirmDelete") : t("family.setup.confirmLeave")}
        actions={
          <>
            <Button variant="ghost" onClick={() => { setDeleteOpen(false); setDeletePwd("") }}>{t("actions.cancel")}</Button>
            <Button variant="danger" onClick={() => void onDelete()}>{t("actions.confirm")}</Button>
          </>
        }
      >
        <p className="amk-muted">{ownRow?.role === "guardian" ? t("family.setup.confirmDeleteDesc") : t("family.setup.confirmLeaveDesc") || "Leave the family?"}</p>
        {ownRow?.role === "guardian" && (
          <Input label={t("passwords.deleteVault.account") || "Account password"} type="password" value={deletePwd} onChange={(e) => setDeletePwd(e.target.value)} />
        )}
      </Modal>
    </div>
  )
}

export default Family
