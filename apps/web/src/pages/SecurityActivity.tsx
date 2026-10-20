import { useState } from "react"
import { Button, Card, EmptyState, ErrorState, Skeleton } from "../design/components"
import { Modal } from "../design/components"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { api } from "../lib/api"
import { errorMessage, useAsync } from "../lib/useAsync"
import { deviceTypeFromLabel, formatDevice } from "../lib/deviceName"
import { DeviceIcon } from "../components/security/DeviceIcon"
import { SegmentedTabs } from "../components/security/SegmentedTabs"
import { AlertCard } from "../components/security/AlertCard"

type Tab = "sessions" | "activity" | "alerts"

export default function SecurityActivity() {
  const t = useT()
  const { locale: themeLocale } = useTheme()
  const locale = (themeLocale === "ar" ? "ar" : "en") as "ar" | "en"
  const [tab, setTab] = useState<Tab>("sessions")
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

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
      setConfirmOpen(false)
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

      <SegmentedTabs tabs={tabs} value={tab} onChange={(v) => setTab(v as Tab)} />

      {tab === "sessions" && (
        <Card padded elevated title={t("security.tabs.sessions")}>
          {sessions.loading && <Skeleton height={48} />}
          {sessions.error ? <ErrorState title={t("common.error")} message={errorMessage(sessions.error, t("common.error"))} /> : null}
          {!sessions.loading && !sessions.error && (sessions.data ?? []).length === 0 && (
            <EmptyState title={t("common.none")} />
          )}
          {!sessions.loading && !sessions.error && (sessions.data ?? []).length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {(sessions.data ?? []).map((s: any) => {
                const type = deviceTypeFromLabel(s.device)
                return (
                  <div
                    key={s.jti}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-3)",
                      padding: "var(--space-3)",
                      borderRadius: "var(--c-radius-md)",
                      border: "1px solid var(--c-border)",
                      background: "var(--c-surface)",
                    }}
                  >
                    <div style={{ color: "var(--c-brand)" }}>
                      <DeviceIcon type={type} size={22} />
                    </div>
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                        <span style={{ fontWeight: 600, color: "var(--c-text)" }}>{formatDevice(s.device, locale)}</span>
                        {s.current && (
                          <span
                            style={{
                              background: "var(--c-success)",
                              color: "#fff",
                              fontSize: "var(--fs-xs)",
                              padding: "2px 8px",
                              borderRadius: "var(--c-radius-sm)",
                              fontWeight: 700,
                            }}
                          >
                            {t("security.sessions.current_device")}
                          </span>
                        )}
                      </div>
                      <span style={{ color: "var(--c-muted)", fontSize: "var(--fs-xs)" }}>
                        {s.ip || "—"} · {t("security.sessions.last_used")}: {new Date(s.last_used).toLocaleString()}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div>
                <Button variant="danger" onClick={() => setConfirmOpen(true)} loading={revoking}>
                  {t("security.sessions.revoke_all")}
                </Button>
                {revokeError && <p style={{ color: "var(--c-danger)", fontSize: "var(--fs-sm)", marginTop: "var(--space-2)" }}>{revokeError}</p>}
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
              {(activity.data ?? []).map((e: any, i: number) => {
                const type = deviceTypeFromLabel(e.device)
                return (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "var(--space-2)",
                      borderRadius: "var(--c-radius-md)",
                      background: e.suspicious ? "var(--c-surface)" : "var(--c-surface)",
                      border: `1px solid ${e.suspicious ? "var(--c-danger)" : "var(--c-border)"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <div style={{ color: e.suspicious ? "var(--c-danger)" : e.success ? "var(--c-success)" : "var(--c-warning)" }}>
                        <DeviceIcon type={type} size={18} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ color: "var(--c-text)", fontWeight: 600, fontSize: "var(--fs-sm)" }}>
                          {e.success ? t("security.activity.success") : t("security.activity.failed")}
                          {e.suspicious && (
                            <span style={{ color: "var(--c-danger)", marginLeft: "var(--space-1)", fontSize: "var(--fs-xs)" }}>
                              ({t("security.activity.suspicious")})
                            </span>
                          )}
                        </span>
                        <span style={{ color: "var(--c-muted)", fontSize: "var(--fs-xs)" }}>
                          {formatDevice(e.device, locale)} · {e.ip || "—"}
                        </span>
                      </div>
                    </div>
                    <span style={{ color: "var(--c-muted)", fontSize: "var(--fs-xs)" }}>
                      {new Date(e.timestamp).toLocaleString()}
                    </span>
                  </li>
                )
              })}
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
                <AlertCard
                  key={a.id}
                  id={a.id}
                  reasons={a.reasons ?? []}
                  createdAt={a.created_at}
                  device={a.event?.device ?? ""}
                  ip={a.event?.ip ?? null}
                  onMarkRead={markRead}
                  onNotMe={() => setConfirmOpen(true)}
                />
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t("security.sessions.revoke_confirm_title")}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>{t("actions.cancel")}</Button>
            <Button variant="danger" onClick={() => void revokeAll()} loading={revoking}>
              {t("security.alerts.wasnt_me_confirm")}
            </Button>
          </>
        }
      >
        <p style={{ color: "var(--c-text)" }}>{t("security.sessions.revoke_confirm_body")}</p>
      </Modal>
    </div>
  )
}
