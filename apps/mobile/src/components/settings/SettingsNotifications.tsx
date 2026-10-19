import { useEffect, useState } from "react"
import { Switch, Text, View } from "react-native"
import type { NotificationPreferences as Preferences } from "@amanak/shared-types"
import { api } from "../../lib/api"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

/** The five categories, in display order, with their i18n labels. */
const TOGGLES: Array<{ key: keyof Preferences; label: string }> = [
  { key: "security_alerts", label: "settings.notifications.security_alerts" },
  { key: "breach_alerts", label: "settings.notifications.breach_alerts" },
  { key: "scan_results", label: "settings.notifications.scan_results" },
  { key: "family_activity", label: "settings.notifications.family_activity" },
  { key: "product_updates", label: "settings.notifications.product_updates" },
]

/**
 * Notification preferences (P17.7b).
 *
 * Reads `GET /api/v1/notifications/preferences/` once and PATCHes a single
 * toggle on change, optimistically reverting if the request fails.
 */
export function SettingsNotifications() {
  const tokens = useTokens()
  const { t } = useLocale()
  const [preferences, setPreferences] = useState<Preferences | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    api
      .getNotificationPreferences()
      .then((data) => {
        if (active) setPreferences(data)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [])

  async function toggle(key: keyof Preferences, value: boolean) {
    if (!preferences) return
    const previous = preferences
    setPreferences({ ...previous, [key]: value })
    setError(false)
    try {
      await api.updateNotificationPreferences({ [key]: value } as Partial<Preferences>)
    } catch {
      setPreferences(previous)
      setError(true)
    }
  }

  return (
    <View>
      {TOGGLES.map(({ key, label }) => (
        <View
          key={key}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingVertical: tokens.space[2],
            gap: tokens.space[3],
          }}
        >
          <Text style={{ color: tokens.c.text, flex: 1 }}>{t(label)}</Text>
          <Switch
            accessibilityLabel={t(label)}
            value={preferences?.[key] ?? false}
            disabled={preferences === null}
            onValueChange={(value) => void toggle(key, value)}
          />
        </View>
      ))}
      {error ? (
        <Text style={{ color: tokens.c.danger, paddingVertical: tokens.space[2] }}>
          {t("settings.notifications.save_error")}
        </Text>
      ) : null}
    </View>
  )
}
