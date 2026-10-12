import type { Incident, IncidentInput } from "@amanak/shared-types"
import { useState, type FormEvent } from "react"
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Skeleton,
  Textarea,
  useToast,
  type BadgeVariant,
} from "../design/components"
import { IconCheck, IconEdit, IconIncidents, IconPlus, IconTrash } from "../design/icons"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"

const INCIDENT_TYPES = ["phishing", "malware", "breach", "other"] as const

function typeVariant(type: string): BadgeVariant {
  if (type === "malware" || type === "breach") return "danger"
  if (type === "phishing") return "warning"
  return "neutral"
}

function IncidentForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Incident | null
  onClose: () => void
  onSaved: () => void
}) {
  const t = useT()
  const [title, setTitle] = useState(initial?.title ?? "")
  const [type, setType] = useState(initial?.incident_type ?? "other")
  const [description, setDescription] = useState(initial?.description ?? "")
  const [resolved, setResolved] = useState(initial?.resolved ?? false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError(t("incidents.what"))
      return
    }
    setBusy(true)
    setError(null)
    try {
      if (initial) {
        const payload: { title: string; description: string; incident_type: string; resolved: boolean } = {
          title,
          description,
          incident_type: type,
          resolved,
        }
        await api.updateIncident(initial.id, payload)
      } else {
        await api.createIncident({ title, description, incident_type: type })
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
        label={t("incidents.what")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        error={error ?? undefined}
      />
      <div className="amk-field">
        <label className="amk-label" htmlFor="incident-type">
          {t("incidents.type")}
        </label>
        <select
          id="incident-type"
          className="amk-select"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          {INCIDENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`incidents.type.${value}`)}
            </option>
          ))}
        </select>
      </div>
      <Textarea
        label={`${t("incidents.what")} (${t("common.optional")})`}
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      {initial && (
        <label className="amk-check">
          <input
            type="checkbox"
            checked={resolved}
            onChange={(e) => setResolved(e.target.checked)}
          />
          <span>{t("incidents.resolved")}</span>
        </label>
      )}
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

export function Incidents() {
  const t = useT()
  const { push } = useToast()
  const incidents = useAsync<Incident[]>(() => api.listIncidents())

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Incident | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Incident | null>(null)
  const [deleting, setDeleting] = useState(false)

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(incident: Incident) {
    setEditing(incident)
    setFormOpen(true)
  }

  async function toggleResolved(incident: Incident) {
    try {
      const payload = { resolved: !incident.resolved } as Partial<IncidentInput> & {
        resolved: boolean
      }
      await api.updateIncident(incident.id, payload)
      incidents.reload()
    } catch (err) {
      push(errorMessage(err, t("common.error")), "error")
    }
  }

  async function onDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api.deleteIncident(pendingDelete.id)
      setPendingDelete(null)
      incidents.reload()
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
          <h1>{t("incidents.title")}</h1>
          <p>{t("incidents.subtitle")}</p>
        </div>
        <Button icon={<IconPlus size={16} />} onClick={openCreate}>
          {t("incidents.add")}
        </Button>
      </div>

      {incidents.loading ? (
        <Card padded>
          <div className="amk-stack">
            <Skeleton height={44} />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </div>
        </Card>
      ) : incidents.error ? (
        <ErrorState
          title={t("common.error")}
          message={errorMessage(incidents.error, t("common.error"))}
          onRetry={incidents.reload}
          retryLabel={t("actions.retry")}
        />
      ) : (incidents.data?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<IconIncidents size={30} />}
          title={t("incidents.empty.title")}
          description={t("incidents.empty.description")}
          action={
            <Button icon={<IconPlus size={16} />} onClick={openCreate}>
              {t("incidents.add")}
            </Button>
          }
        />
      ) : (
        <div className="amk-tablewrap">
          <table className="amk-table">
            <thead>
              <tr>
                <th>{t("incidents.what")}</th>
                <th>{t("incidents.type")}</th>
                <th>{t("incidents.status")}</th>
                <th>{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {incidents.data!.map((incident) => (
                <tr key={incident.id}>
                  <td>{incident.title}</td>
                  <td>
                    <Badge variant={typeVariant(incident.incident_type)}>
                      {INCIDENT_TYPES.includes(incident.incident_type as (typeof INCIDENT_TYPES)[number])
                        ? t(`incidents.type.${incident.incident_type}`)
                        : incident.incident_type}
                    </Badge>
                  </td>
                  <td>
                    <Badge variant={incident.resolved ? "success" : "warning"}>
                      {incident.resolved ? t("incidents.resolved") : t("incidents.open")}
                    </Badge>
                  </td>
                  <td>
                    <div className="amk-row">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconCheck size={16} />}
                        aria-label={
                          incident.resolved ? t("incidents.open") : t("incidents.resolved")
                        }
                        onClick={() => void toggleResolved(incident)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconEdit size={16} />}
                        aria-label={t("actions.edit")}
                        onClick={() => openEdit(incident)}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<IconTrash size={16} />}
                        aria-label={t("actions.delete")}
                        onClick={() => setPendingDelete(incident)}
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
        title={editing ? t("actions.edit") : t("incidents.add")}
      >
        <IncidentForm
          key={editing?.id ?? "new"}
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={incidents.reload}
        />
      </Modal>

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={t("incidents.deleteConfirm.title")}
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
        <p className="amk-muted">{t("incidents.deleteConfirm.description")}</p>
      </Modal>
    </div>
  )
}
