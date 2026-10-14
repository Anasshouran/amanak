import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import type { NotificationList } from "@amanak/shared-types"
import { useT } from "../design/i18n"
import { IconBell } from "../design/icons"
import { api } from "../lib/api"
import { formatDateTime } from "../lib/format"
import { useTheme } from "../design/ThemeProvider"

const PREVIEW_LIMIT = 10

export function NotificationsBell() {
  const t = useT()
  const { locale } = useTheme()
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<NotificationList | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  async function load() {
    try {
      setData(await api.listNotifications())
    } catch {
      // A missing/unavailable inbox must never break the header.
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!open) return
    function onDocClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  const unread = data?.unread ?? 0
  const items = (data?.results ?? []).slice(0, PREVIEW_LIMIT)

  async function onRead(id: number) {
    await api.markNotificationRead(id)
    await load()
  }

  async function onMarkAll() {
    await api.markAllNotificationsRead()
    await load()
  }

  return (
    <div className="amk-bell" ref={containerRef}>
      <button
        type="button"
        className="amk-iconbtn"
        aria-label={t("notifications.title")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <IconBell />
        {unread > 0 && (
          <span className="amk-bell__badge" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="amk-bell__panel" role="dialog" aria-label={t("notifications.title")}>
          <div className="amk-bell__head">
            <strong>{t("notifications.title")}</strong>
            {unread > 0 && (
              <button type="button" className="amk-linklike" onClick={() => void onMarkAll()}>
                {t("notifications.markAllRead")}
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="amk-muted" style={{ padding: "8px 12px" }}>
              {t("notifications.empty")}
            </p>
          ) : (
            <ul className="amk-bell__list">
              {items.map((n) => (
                <li key={n.id} className={n.read ? "amk-bell__item" : "amk-bell__item is-unread"}>
                  <button type="button" className="amk-bell__row" onClick={() => void onRead(n.id)}>
                    <span className="amk-bell__subject">{n.subject}</span>
                    <span className="amk-muted" style={{ fontSize: 12 }}>
                      {formatDateTime(n.created_at, locale)}
                    </span>
                  </button>
                  <p className="amk-bell__body">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="amk-bell__foot">
            <Link to="/notifications" onClick={() => setOpen(false)}>
              {t("notifications.seeAll")}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
