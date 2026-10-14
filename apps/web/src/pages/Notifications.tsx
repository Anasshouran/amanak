import { useState } from "react"
import { Button, Card, EmptyState, ErrorState, Skeleton, useToast } from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { formatDateTime } from "../lib/format"
import { errorMessage, useAsync } from "../lib/useAsync"

export function Notifications() {
  const t = useT()
  const { locale } = useTheme()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const list = useAsync(() => api.listNotifications(), [])

  async function markAll() {
    setBusy(true)
    try {
      await api.markAllNotificationsRead()
      list.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("common.error")), "error")
    } finally {
      setBusy(false)
    }
  }

  async function markOne(id: number) {
    try {
      await api.markNotificationRead(id)
      list.reload()
    } catch (err) {
      toast.push(errorMessage(err, t("common.error")), "error")
    }
  }

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("notifications.title")}</h1>
          <p>{t("notifications.subtitle")}</p>
        </div>
        {(list.data?.unread ?? 0) > 0 && (
          <Button variant="secondary" onClick={() => void markAll()} disabled={busy}>
            {t("notifications.markAllRead")}
          </Button>
        )}
      </div>

      {list.error ? (
        <ErrorState
          title={t("common.error")}
          message={errorMessage(list.error, t("common.error"))}
          onRetry={list.reload}
        />
      ) : list.loading && !list.data ? (
        <Skeleton height={160} />
      ) : (list.data?.results.length ?? 0) === 0 ? (
        <EmptyState
          title={t("notifications.empty")}
          description={t("notifications.emptyHint")}
        />
      ) : (
        <Card padded elevated>
          <ul className="amk-list">
            {list.data!.results.map((n) => (
              <li key={n.id} className="amk-listitem">
                <div>
                  <strong>{n.subject}</strong>
                  <p className="amk-muted" style={{ whiteSpace: "pre-wrap" }}>
                    {n.body}
                  </p>
                  <span className="amk-muted" style={{ fontSize: 12 }}>
                    {formatDateTime(n.created_at, locale)}
                  </span>
                </div>
                {!n.read && (
                  <button type="button" className="amk-linklike" onClick={() => void markOne(n.id)}>
                    {t("notifications.markRead")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
