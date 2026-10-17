import type { TwoFactorEntry, TwoFactorProfile } from "@amanak/shared-types"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useT } from "../../design/i18n"
import { Button, Card, ConfirmModal, EmptyState, Skeleton, useToast } from "../../design/components"
import { IconCopy, IconEdit, IconPlus, IconTrash } from "../../design/icons"
import { api } from "../../lib/api"
import { errorMessage, useAsync } from "../../lib/useAsync"
import { Tabs } from "../../design/components/Tabs"
import { TwoFactorRow } from "./TwoFactorRow"
import { TwoFactorAddModal } from "./TwoFactorAddModal"
import { TwoFactorEditModal } from "./TwoFactorEditModal"
import { TotpDisplay } from "./TotpDisplay"

const AUTO_LOCK_MS = 5 * 60 * 1000
const TOTP_STEP_MS = 30_000

export type TwoFactorListProps = {
  profile: TwoFactorProfile | null
  onAutoLocked: () => void
  onVaultDeleted: () => void
  addOpen?: boolean
  onAddOpenChange?: (open: boolean) => void
}

export function TwoFactorList({
  profile,
  onAutoLocked,
  onVaultDeleted,
  addOpen: addOpenProp,
  onAddOpenChange,
}: TwoFactorListProps) {
  const t = useT()
  const toast = useToast()
  const [tab, setTab] = useState<"apps" | "backup">("apps")
  const [entries, setEntries] = useState<TwoFactorEntry[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [reloadNonce, setReloadNonce] = useState(0)
  const [internalAddOpen, setInternalAddOpen] = useState(false)
  const addOpen = addOpenProp ?? internalAddOpen
  const setAddOpen = onAddOpenChange ?? setInternalAddOpen
  const [editTarget, setEditTarget] = useState<TwoFactorEntry | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TwoFactorEntry | null>(null)
  const [deleteVaultOpen, setDeleteVaultOpen] = useState(false)
  const [deletingVault, setDeletingVault] = useState(false)
  const [now, setNow] = useState(Date.now())

  const reload = useCallback(() => setReloadNonce((n) => n + 1), [])

  useEffect(() => {
    let active = true
    setLoading(true)
    api
      .listTwoFactorEntries()
      .then((data) => {
        if (active) setEntries(data)
      })
      .catch((err) => {
        if (active) setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [reloadNonce])

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  // Auto-lock after 5 minutes of inactivity while the vault is open.
  const idleTimerRef = useRef<number>(0)
  useEffect(() => {
    function poke() {
      window.clearTimeout(idleTimerRef.current)
      idleTimerRef.current = window.setTimeout(lockAfterIdle, AUTO_LOCK_MS)
    }
    poke()
    const events = ["pointerdown", "keydown", "scroll", "wheel", "touchstart"] as const
    events.forEach((name) => window.addEventListener(name, poke, { passive: true }))
    return () => {
      events.forEach((name) => window.removeEventListener(name, poke))
      window.clearTimeout(idleTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function lockAfterIdle() {
    // We need to drop the key and notify the parent to lock the vault.
    // However, we don't have access to the key dropping function here.
    // We'll rely on the parent to handle locking via the onAutoLocked callback.
    // The parent (TwoFactor page) will handle dropping the key.
    onAutoLocked()
  }

  const filteredEntries = useMemo(() => {
    const rows = entries ?? []
    if (tab === "backup") {
      return [] // We'll show empty state for backup codes
    }
    return rows
  }, [entries, tab])

  async function deleteVault() {
    setDeletingVault(true)
    try {
      await api.deleteTwoFactorProfile()
      onVaultDeleted()
    } finally {
      setDeletingVault(false)
      setDeleteVaultOpen(false)
    }
  }

  async function deleteEntry() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    try {
      await api.deleteTwoFactorEntry(target.id)
      toast.push(t("twofa.deleted"), "success")
      reload()
    } catch {
      // leave the list unchanged when deletion fails
    }
  }

  return (
    <>
      {/* Header with tabs will be handled in the page component */}
      <div className="amk-stack">
        {tab === "apps" ? (
          <>
            {loading && !entries ? (
              <>
                <Skeleton height={96} />
                <Skeleton height={96} />
              </>
            ) : error ? (
              <div className="amk-error-state">
                <p className="amk-field-error" role="alert">
                  {errorMessage(error, t("common.error"))}
                </p>
                <Button onClick={reload}>{t("actions.retry")}</Button>
              </div>
            ) : entries && entries.length === 0 ? (
              <EmptyState
                icon={<IconPlus size={30} />}
                title={t("2fa.list.empty.title")}
                description={t("2fa.list.empty.description")}
                action={
                  <Button icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
                    {t("2fa.addEntry")}
                  </Button>
                }
              />
            ) : (
              <>
                <div className="vault-2fa-list">
                  {filteredEntries.map((entry) => (
                    <TwoFactorRow
                      key={entry.id}
                      entry={entry}
                      now={now}
                      onEdit={() => setEditTarget(entry)}
                      onDelete={() => setDeleteTarget(entry)}
                      onCopy={async () => {
                        // We'll implement copy in the row
                      }}
                    />
                  ))}
                </div>
                {entries && entries.length > 0 && (
                  <div className="vault-2fa-list__add">
                    <Button icon={<IconPlus size={16} />} onClick={() => setAddOpen(true)}>
                      {t("2fa.addEntry")}
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <EmptyState
            icon={<IconPlus size={30} />}
            title={t("twofa.backup.empty.title")}
            description={t("twofa.backup.empty.description")}
          />
        )}

        <Card className="amk-card--danger" title={t("2fa.danger.title")}>
          <div className="amk-row" style={{ justifyContent: "space-between" }}>
            <span className="amk-muted">{t("2fa.deleteVault.description")}</span>
            <Button variant="danger" icon={<IconTrash size={16} />} onClick={() => setDeleteVaultOpen(true)}>
              {t("twofa.delete_vault")}
            </Button>
          </div>
        </Card>
      </div>

      {/* Modals */}
      <TwoFactorAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false)
          reload()
        }}
      />

      <TwoFactorEditModal
        entry={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          setEditTarget(null)
          toast.push(t("twofa.edit_saved"), "success")
          reload()
        }}
      />

      <ConfirmModal
        open={deleteTarget !== null}
        title={t("twofa.delete_entry.confirm_title")}
        description={t("twofa.delete_entry.confirm_body")}
        confirmText={t("actions.delete")}
        cancelText={t("actions.cancel")}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void deleteEntry()}
      />

      <ConfirmModal
        open={deleteVaultOpen}
        title={t("twofa.delete_vault.confirm_title")}
        description={t("twofa.delete_vault.confirm_body")}
        confirmText={t("actions.delete")}
        cancelText={t("actions.cancel")}
        onClose={() => setDeleteVaultOpen(false)}
        onConfirm={() => void deleteVault()}
      />
    </>
  )
}
