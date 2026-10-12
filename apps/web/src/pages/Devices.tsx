import type { Device } from "@amanak/shared-types"
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
import { IconDevices, IconEdit, IconPlus, IconTrash } from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDate } from "../lib/format"
import { errorMessage, useAsync } from "../lib/useAsync"

function DeviceForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Device | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [name, setName] = useState(initial?.device_name ?? "")
  const [platform, setPlatform] = useState(initial?.platform ?? "")
  const [type, setType] = useState(initial?.device_type ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim()) {
      setError(t("devices.name"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (initial) {
        await api.updateDevice(initial.id, {
          device_name: name,
          platform,
          device_type: type,
          notes,
        })
      } else {
        await api.createDevice({ device_name: name, platform, device_type: type, notes })
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
        label={t("devices.name")}
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={error ?? undefined}
      />
      <div className="amk-grid amk-grid--two">
        <Input
          label={`${t("devices.platform")} (${t("common.optional")})`}
          value={platform}
          onChange={(e) => setPlatform(e.target.value)}
        />
        <Input
          label={`${t("devices.type")} (${t("common.optional")})`}
          value={type}
          onChange={(e) => setType(e.target.value)}
        />
      </div>
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

export function Devices() {
  const t = useT()
  const { locale } = useTheme()
  const { push } = useToast()
  const devices = useAsync<Device[]>(() => api.listDevices())

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Device | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Device | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(device: Device) {
    setEditing(device)
    setFormOpen(true)
  }

  async function onDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api.deleteDevice(pendingDelete.id)
      setPendingDelete(null)
      devices.reload()
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
          <h1>{t("devices.title")}</h1>
          <p>{t("devices.subtitle")}</p>
        </div>
        <Button icon={<IconPlus size={16} />} onClick={openCreate}>
          {t("devices.add")}
        </Button>
      </div>

      {devices.loading ? (
        <Card padded>
          <div className="amk-stack">
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        </Card>
      ) : devices.error ? (
        <ErrorState
          title={t("common.error")}
          message={errorMessage(devices.error, t("common.error"))}
          onRetry={devices.reload}
          retryLabel={t("actions.retry")}
        />
      ) : (devices.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<IconDevices size={30} />}
          title={t("devices.empty.title")}
          description={t("devices.empty.description")}
          action={
            <Button icon={<IconPlus size={16} />} onClick={openCreate}>
              {t("devices.add")}
            </Button>
          }
        />
      ) : (
        <div className="amk-tablewrap">
          <table className="amk-table">
            <thead>
              <tr>
                <th>{t("devices.name")}</th>
                <th>{t("devices.platform")}</th>
                <th>{t("devices.type")}</th>
                <th>{t("devices.lastReported")}</th>
                <th>{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {devices.data!.map((device) => (
                <tr key={device.id}>
                  <td>{device.device_name}</td>
                  <td className="amk-muted">{device.platform || t("common.none")}</td>
                  <td className="amk-muted">{device.device_type || t("common.none")}</td>
                  <td className="amk-muted">{formatDate(device.last_reported, locale)}</td>
                  <td>
                    <div className="amk-row">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconEdit size={16} />}
                        aria-label={t("actions.edit")}
                        onClick={() => openEdit(device)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconTrash size={16} />}
                        aria-label={t("actions.delete")}
                        onClick={() => setPendingDelete(device)}
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
        title={editing ? t("actions.edit") : t("devices.add")}
      >
        <DeviceForm
          key={editing?.id ?? "new"}
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={devices.reload}
        />
      </Modal>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("devices.deleteConfirm.title")}
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
        <p className="amk-muted">{t("devices.deleteConfirm.description")}</p>
      </Modal>
    </div>
  )
}
