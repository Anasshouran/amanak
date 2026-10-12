import type {
  BreachHit,
  CheckSummary,
  MonitoredEmail,
} from "@amanak/shared-types"
import { useMemo, useState, type FormEvent } from "react"
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  Skeleton,
} from "../design/components"
import { IconPlus, IconShield, IconTrash } from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDate } from "../lib/format"
import { errorMessage, useAsync } from "../lib/useAsync"

function isDisabled(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | undefined
  const code = (e?.code ?? "").toLowerCase()
  const message = (e?.message ?? "").toLowerCase()
  return code.includes("disabled") || message.includes("disabled")
}

export function BreachMonitor() {
  const t = useT()
  const { locale } = useTheme()

  const emails = useAsync<MonitoredEmail[]>(() => api.listMonitoredEmails())
  const hits = useAsync<BreachHit[]>(() => api.listHits())

  const [email, setEmail] = useState("")
  const [label, setLabel] = useState("")
  const [consent, setConsent] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<MonitoredEmail | null>(null)
  const [removing, setRemoving] = useState(false)
  const [checking, setChecking] = useState(false)
  const [summary, setSummary] = useState<CheckSummary | null>(null)

  const hitsByEmail = useMemo(() => {
    const map = new Map<number, BreachHit[]>()
    for (const hit of hits.data ?? []) {
      const list = map.get(hit.monitored_email) ?? []
      list.push(hit)
      map.set(hit.monitored_email, list)
    }
    return map
  }, [hits.data])

  async function onAdd(event: FormEvent) {
    event.preventDefault()
    if (!consent) {
      setFormError(t("breach.consentRequired"))
      return
    }
    if (!email.trim()) return
    setAdding(true)
    setFormError(null)
    try {
      await api.addMonitoredEmail({ email, label, consent })
      setEmail("")
      setLabel("")
      setConsent(false)
      emails.reload()
    } catch (err) {
      if (isDisabled(err)) {
        emails.reload()
      } else {
        setFormError(errorMessage(err, t("common.error")))
      }
    } finally {
      setAdding(false)
    }
  }

  async function onRemove() {
    if (!pendingRemove) return
    setRemoving(true)
    try {
      await api.removeMonitoredEmail(pendingRemove.id)
      setPendingRemove(null)
      emails.reload()
      hits.reload()
    } finally {
      setRemoving(false)
    }
  }

  async function onCheck() {
    setChecking(true)
    try {
      const result = await api.checkBreaches()
      setSummary(result)
      hits.reload()
    } catch (err) {
      if (isDisabled(err)) emails.reload()
    } finally {
      setChecking(false)
    }
  }

  const disabled = isDisabled(emails.error) || isDisabled(hits.error)

  if (disabled) {
    return (
      <div className="amk-page">
        <div className="amk-page-head">
          <div>
            <h1>{t("breach.title")}</h1>
            <p>{t("breach.subtitle")}</p>
          </div>
        </div>
        <EmptyState
          icon={<IconShield size={30} />}
          title={t("breach.disabled.title")}
          description={t("breach.disabled.description")}
        />
      </div>
    )
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("breach.title")}</h1>
          <p>{t("breach.subtitle")}</p>
        </div>
        <Button
          variant="secondary"
          loading={checking}
          onClick={() => void onCheck()}
          disabled={(emails.data?.length ?? 0) === 0}
        >
          {t("actions.checkNow")}
        </Button>
      </div>

      {summary && (
        <Card padded>
          <span className="amk-muted">
            {t("breach.summary", {
              checked: summary.checked,
              new: summary.hits_new,
              total: summary.hits_total,
            })}
          </span>
        </Card>
      )}

      <Card padded elevated title={t("breach.add.title")}>
        <form className="amk-stack" onSubmit={(e) => void onAdd(e)} noValidate>
          <div className="amk-grid amk-grid--two">
            <Input
              label={t("breach.email")}
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={formError ?? undefined}
            />
            <Input
              label={`${t("breach.label")} (${t("common.optional")})`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <label className="amk-check">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => {
                setConsent(e.target.checked)
                if (e.target.checked) setFormError(null)
              }}
            />
            <span>{t("breach.consent")}</span>
          </label>
          {!consent && formError && (
            <span className="amk-field-error" role="alert">
              {formError}
            </span>
          )}
          <div className="amk-row">
            <Button
              type="submit"
              icon={<IconPlus size={16} />}
              loading={adding}
              disabled={!consent || !email.trim()}
            >
              {t("actions.addEmail")}
            </Button>
          </div>
        </form>
      </Card>

      <Card padded elevated title={t("breach.list.title")}>
        {emails.loading ? (
          <div className="amk-stack">
            <Skeleton height={48} />
            <Skeleton height={48} />
          </div>
        ) : emails.error ? (
          <ErrorState
            title={t("common.error")}
            message={errorMessage(emails.error, t("common.error"))}
            onRetry={emails.reload}
            retryLabel={t("actions.retry")}
          />
        ) : (emails.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<IconShield size={30} />}
            title={t("breach.list.empty.title")}
            description={t("breach.list.empty.description")}
          />
        ) : (
          <ul className="amk-list">
            {emails.data!.map((item) => (
              <li className="amk-listitem" key={item.id}>
                <div style={{ display: "grid", gap: 2 }}>
                  <span style={{ fontWeight: 600 }}>{item.label || item.email}</span>
                  <span className="amk-muted" dir="ltr">
                    {item.email}
                  </span>
                </div>
                <div className="amk-row">
                  <Badge variant={(hitsByEmail.get(item.id)?.length ?? 0) > 0 ? "danger" : "neutral"}>
                    {t("breach.hit.count", { count: hitsByEmail.get(item.id)?.length ?? 0 })}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<IconTrash size={16} />}
                    aria-label={t("actions.remove")}
                    onClick={() => setPendingRemove(item)}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padded elevated title={t("breach.hits.title")}>
        {hits.loading ? (
          <div className="amk-stack">
            <Skeleton height={64} />
            <Skeleton height={64} />
          </div>
        ) : hits.error ? (
          <ErrorState
            title={t("common.error")}
            message={errorMessage(hits.error, t("common.error"))}
            onRetry={hits.reload}
            retryLabel={t("actions.retry")}
          />
        ) : (hits.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<IconShield size={30} />}
            title={t("breach.hits.empty.title")}
            description={t("breach.hits.empty.description")}
          />
        ) : (
          <div className="amk-stack">
            {emails.data!
              .filter((item) => (hitsByEmail.get(item.id)?.length ?? 0) > 0)
              .map((item) => (
                <div key={item.id}>
                  <h4 className="amk-muted" style={{ marginBottom: 8 }}>
                    {t("breach.hits.for", { email: item.email })}
                  </h4>
                  <ul className="amk-list">
                    {hitsByEmail.get(item.id)!.map((hit) => (
                      <li className="amk-listitem" key={hit.id} style={{ alignItems: "flex-start" }}>
                        <div style={{ display: "grid", gap: 6, flex: 1 }}>
                          <div className="amk-row" style={{ justifyContent: "space-between" }}>
                            <span style={{ fontWeight: 600 }}>{hit.name}</span>
                            <Badge variant={hit.is_verified ? "danger" : "warning"}>
                              {hit.is_verified ? t("breach.verified") : t("breach.unverified")}
                            </Badge>
                          </div>
                          <span className="amk-muted" style={{ fontSize: 12 }}>
                            {formatDate(hit.breach_date, locale)} · {hit.domain}
                          </span>
                          {hit.data_classes.length > 0 && (
                            <div className="amk-row">
                              {hit.data_classes.map((dc) => (
                                <Badge key={dc} variant="neutral">
                                  {dc}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </Card>

      <Modal
        open={pendingRemove !== null}
        onClose={() => setPendingRemove(null)}
        title={t("breach.removeConfirm.title")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPendingRemove(null)}>
              {t("actions.cancel")}
            </Button>
            <Button variant="danger" loading={removing} onClick={() => void onRemove()}>
              {t("actions.remove")}
            </Button>
          </>
        }
      >
        <p className="amk-muted">{t("breach.removeConfirm.description")}</p>
      </Modal>
    </div>
  )
}
