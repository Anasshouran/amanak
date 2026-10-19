import { useState } from "react"
import { Pressable, Text, View } from "react-native"
import { api } from "../../lib/api"
import { useLocale } from "../../design/LocaleProvider"
import { useTokens } from "../../design/tokens"

type Status = "idle" | "working" | "ready" | "error"

/**
 * Self-service data download (P17.7b).
 *
 * Requests a one-time export token via `POST /api/v1/me/export/`. The actual
 * download link is delivered out-of-band; this control only reports that the
 * export is ready (matching the staff flow's token semantics).
 */
export function SettingsPrivacy() {
  const tokens = useTokens()
  const { t } = useLocale()
  const [status, setStatus] = useState<Status>("idle")

  async function requestExport() {
    setStatus("working")
    try {
      await api.requestMyExport()
      setStatus("ready")
    } catch {
      setStatus("error")
    }
  }

  return (
    <View style={{ gap: tokens.space[2] }}>
      <Pressable
        accessibilityRole="button"
        disabled={status === "working"}
        onPress={() => void requestExport()}
        style={{
          paddingVertical: tokens.space[3],
          paddingHorizontal: tokens.space[4],
          borderWidth: 1,
          borderColor: tokens.c.border,
          borderRadius: tokens.radius.md,
          alignItems: "center",
          opacity: status === "working" ? 0.5 : 1,
        }}
      >
        <Text style={{ color: tokens.c.text, fontWeight: "600" }}>
          {status === "working" ? t("settings.privacy.downloading") : t("settings.privacy.download")}
        </Text>
      </Pressable>
      {status === "ready" ? (
        <Text style={{ color: tokens.c.muted }}>{t("settings.privacy.download_ready")}</Text>
      ) : null}
      {status === "error" ? (
        <Text style={{ color: tokens.c.danger }}>{t("settings.privacy.download_error")}</Text>
      ) : null}
    </View>
  )
}
