import { useState } from "react"
import { Badge, Button, Card, EmptyState, ErrorState, Skeleton, Tabs } from "../design/components"
import { useT } from "../design/i18n"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"

type Tab = "sessions" | "activity" | "alerts"

export default function SecurityActivity() {
  const t = useT()
  const [tab, setTab] = useState<Tab>("sessions")
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)

  const sessions = useAsync(() => api.getSessions())
  const activity = useAsync(() => api.getActivity(50))
  const alerts = useAsync(() => api.getAlerts())

  async function revokeAll() {
    setRevoking(true)
    setRevokeError(null)
    try {
      await api.revokeAllSessions()
      window.location.href = "/login"
    } catch (e) {
      setRevokeError(errorMessage(e, t("common.error")))
    } finally {
      setRevoking(false)
    }
  }

  async function markRead(id: number) {
    try {
      await api.markAlertRead(id)
      await alerts.reload()
    } catch {
      /* ignore */
    }
  }

  const tabs = [
    { id: "sessions", label: t("security.tabs.sessions") },
    { id: "activity", label: t("security.tabs.activity") },
    { id: "alerts", label: t("security.tabs.alerts") },
  ]

  return (
    <div className="amk-page" style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div>
        <h1 style={{ margin: 0, color: "var(--c-text)", fontSize: "var(--fs-2xl)" }}>{t("security.activity.title")}</h1>
      </div>

      <Tabs items={tabs} value={tab} onChange={(v) => setTab(v as Tab)} />

      {tab === "sessions" && (
        <Card padded elevated title={t("security.tabs.sessions")}>
          {sessions.loading && <Skeleton height={48} />}
          {sessions.error ? <ErrorState title={t("common.error")} message={errorMessage(sessions.error, t("common.error"))} /> : null}
          {!sessions.loading && !sessions.error && (sessions.data ?? []).length === 0 && (
            <EmptyState title={t("common.none")} />
          )}
          {!sessions.loading && !sessions.error && (sessions.data ?? []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", color: "var(--c-muted)", fontSize: "var(--fs-sm)" }}>
                      <th style={{ padding: "var(--space-2)" }}>{t("security.sessions.device")}</th>
                      <th style={{ padding: "var(--space-2)" }}>{t("security.sessions.ip")}</th>
                      <th style={{ padding: "var(--space-2)" }}>{t("security.sessions.last_used")}</th>
                      <th style={{ padding: "var(--space-2)" }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(sessions.data ?? []).map((s: any) => (
                      <tr key={s.jti} style={{ borderTop: "1px solid var(--c-border)" }}>
                        <td style={{ padding: "var(--space-2)", color: "var(--c-text)" }}>
                          {s.device}
                          {s.current && (
                            <Badge variant="success" className="ml-2">
                              {t("security.sessions.current")}
                            </Badge>
                          )}
                        </td>
                        <td style={{ padding: "var(--space-2)", color: "var(--c-muted)", fontSize: "var(--fs-sm)" }}>{s.ip || "—"}</td>
                        <td style={{ padding: "var(--space-2)", color: "var(--c-muted)", fontSize: "var(--fs-sm)" }}>
                          {new Date(s.last_used).toLocaleString()}
                        </td>
                        <td style={{ padding: "var(--space-2)" }}>
                          {!s.current && (
                            <span style={{ color: "var(--c-muted)", fontSize: "var(--fs-xs)" }}>{t("security.sessions.revoke")}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <Button variant="danger" onClick={() => void revokeAll()} loading={revoking}>
                  {t("security.sessions.revoke_all")}
                </Button>
                {revokeError && <p style={{ color: "var(--c-danger)", fontSize: "var(--fs-sm)" }}>{revokeError}</p>}
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === "activity" && (
        <Card padded elevated title={t("security.tabs.activity")}>
          {activity.loading && <Skeleton height={48} />}
          {activity.error ? <ErrorState title={t("common.error")} message={errorMessage(activity.error, t("common.error"))} /> : null}
          {!activity.loading && !activity.error && (activity.data ?? []).length === 0 && (
            <EmptyState title={t("common.none")} />
          )}
          {!activity.loading && !activity.error && (activity.data ?? []).length > 0 && (
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {(activity.data ?? []).map((e: any, i: number) => (
                <li
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--space-2)",
                    borderRadius: "var(--c-radius-md)",
                    background: e.suspicious ? "var(--c-danger-soft, var(--c-surface))" : "var(--c-surface)",
                    border: "1px solid var(--c-border)",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ color: "var(--c-text)", fontWeight: 600, fontSize: "var(--fs-sm)" }}>
                      {e.success ? t("security.activity.success") : t("security.activity.failed")}
                      {e.suspicious && (
                        <Badge variant="danger" className="ml-2">
                          {t("security.activity.suspicious")}
                        </Badge>
                      )}
                    </span>
                    <span style={{ color: "var(--c-muted)", fontSize: "var(--fs-xs)" }}>
                      {e.device} · {e.ip || "—"}
                    </span>
                  </div>
                  <span style={{ color: "var(--c-muted)", fontSize: "var(--fs-xs)" }}>
                    {new Date(e.timestamp).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === "alerts" && (
        <Card padded elevated title={t("security.tabs.alerts")}>
          {alerts.loading && <Skeleton height={48} />}
          {alerts.error ? <ErrorState title={t("common.error")} message={errorMessage(alerts.error, t("common.error"))} /> : null}
          {!alerts.loading && !alerts.error && (alerts.data ?? []).length === 0 && (
            <EmptyState title={t("security.alerts.empty")} />
          )}
          {!alerts.loading && !alerts.error && (alerts.data ?? []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {(alerts.data ?? []).map((a: any) => (
                <div
                  key={a.id}
                  style={{
                    padding: "var(--space-3)",
                    borderRadius: "var(--c-radius-md)",
                    border: "1px solid var(--c-border)",
                    background: "var(--c-surface)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-2)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: "var(--space-1)", flexWrap: "wrap" }}>
                      {(a.reasons ?? []).map((r: string) => (
                        <Badge key={r} variant="danger">
                          {r === "new_device"
                            ? t("security.alerts.reason.new_device")
                            : r === "multiple_failed_attempts"
                            ? t("security.alerts.reason.multiple_failed_attempts")
                            : r}
                        </Badge>
                      ))}
                    </div>
                    <span style={{ color: "var(--c-muted)", fontSize: "var(--fs-xs)" }}>
                      {new Date(a.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ color: "var(--c-muted)", fontSize: "var(--fs-sm)" }}>
                    {a.event?.device} · {a.event?.ip || "—"}
                  </div>
                  <div style={{ display: "flex", gap: "var(--space-2)" }}>
                    <Button variant="secondary" size="sm" onClick={() => void markRead(a.id)}>
                      {t("security.alerts.mark_read")}
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => void revokeAll()}
                    >
                      {t("security.alerts.wasnt_me")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
