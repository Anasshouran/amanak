import type { Account } from "@amanak/shared-types"
import { useState, type FormEvent } from "react"
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  Textarea,
  useToast,
} from "../design/components"
import { IconAccounts, IconEdit, IconPlus, IconTrash } from "../design/icons"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"

function AccountForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Account | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [serviceName, setServiceName] = useState(initial?.service_name ?? "")
  const [username, setUsername] = useState(initial?.username ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!serviceName.trim()) {
      setError(t("accounts.service"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (initial) {
        await api.updateAccount(initial.id, {
          service_name: serviceName,
          username,
          notes,
        })
      } else {
        await api.createAccount({ service_name: serviceName, username, notes })
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(errorMessage(err, t("common.error")))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="amk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
      <Input
        label={t("accounts.service")}
        value={serviceName}
        onChange={(e) => setServiceName(e.target.value)}
        error={error ?? undefined}
      />
      <Input
        label={`${t("accounts.username")} (${t("common.optional")})`}
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <Textarea
        label={`${t("accounts.notes")} (${t("common.optional")})`}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="amk-modal__actions">
        <Button variant="ghost" onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button type="submit" loading={busy}>
          {initial ? t("actions.save") : t("actions.create")}
        </Button>
      </div>
    </form>
  )
}

export function Accounts() {
  const t = useT()
  const { push } = useToast()
  const accounts = useAsync<Account[]>(() => api.listAccounts())

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Account | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(account: Account) {
    setEditing(account)
    setFormOpen(true)
  }

  async function onDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api.deleteAccount(pendingDelete.id)
      setPendingDelete(null)
      accounts.reload()
    } catch (err) {
      push(errorMessage(err, t("common.error")), "error")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("accounts.title")}</h1>
          <p>{t("accounts.subtitle")}</p>
        </div>
        <Button icon={<IconPlus size={16} />} onClick={openCreate}>
          {t("accounts.add")}
        </Button>
      </div>

      {accounts.loading ? (
        <Card padded>
          <div className="amk-stack">
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        </Card>
      ) : accounts.error ? (
        <ErrorState
          title={t("common.error")}
          message={errorMessage(accounts.error, t("common.error"))}
          onRetry={accounts.reload}
          retryLabel={t("actions.retry")}
        />
      ) : (accounts.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<IconAccounts size={30} />}
          title={t("accounts.empty.title")}
          description={t("accounts.empty.description")}
          action={
            <Button icon={<IconPlus size={16} />} onClick={openCreate}>
              {t("accounts.add")}
            </Button>
          }
        />
      ) : (
        <div className="amk-tablewrap">
          <table className="amk-table">
            <thead>
              <tr>
                <th>{t("accounts.service")}</th>
                <th>{t("accounts.username")}</th>
                <th>{t("accounts.notes")}</th>
                <th>{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {accounts.data!.map((account) => (
                <tr key={account.id}>
                  <td>{account.service_name}</td>
                  <td className="amk-muted">{account.username || t("common.none")}</td>
                  <td className="amk-muted">{account.notes || t("common.none")}</td>
                  <td>
                    <div className="amk-row">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconEdit size={16} />}
                        aria-label={t("actions.edit")}
                        onClick={() => openEdit(account)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconTrash size={16} />}
                        aria-label={t("actions.delete")}
                        onClick={() => setPendingDelete(account)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("actions.edit") : t("accounts.add")}
      >
        <AccountForm
          key={editing?.id ?? "new"}
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={accounts.reload}
        />
      </Modal>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("accounts.deleteConfirm.title")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              {t("actions.cancel")}
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void onDelete()}>
              {t("actions.delete")}
            </Button>
          </>
        }
      >
        <p className="amk-muted">{t("accounts.deleteConfirm.description")}</p>
      </Modal>
    </div>
  )
}
