import { Button, Card } from "../design/components"
import { IconGlobe, IconLogout, IconMoon, IconSun } from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { useAuth } from "../state/AuthContext"

export function Settings() {
  const t = useT()
  const { theme, locale, setTheme, setLocale } = useTheme()
  const { user, logout } = useAuth()
  const aiEnabled = import.meta.env.VITE_AI_ENABLED === "true"

  return (
    <div className="amk-page">
      <div className="amk-page-head">
        <div>
          <h1>{t("settings.title")}</h1>
          <p>{t("settings.subtitle")}</p>
        </div>
      </div>

      <div className="amk-grid amk-grid--two">
        <Card padded elevated title={t("settings.appearance")}>
          <div className="amk-row">
            <Button
              variant={theme === "dark" ? "primary" : "secondary"}
              icon={<IconMoon size={16} />}
              onClick={() => setTheme("dark")}
            >
              {t("theme.dark")}
            </Button>
            <Button
              variant={theme === "light" ? "primary" : "secondary"}
              icon={<IconSun size={16} />}
              onClick={() => setTheme("light")}
            >
              {t("theme.light")}
            </Button>
          </div>
        </Card>

        <Card padded elevated title={t("settings.language")}>
          <div className="amk-row">
            <Button
              variant={locale === "ar" ? "primary" : "secondary"}
              icon={<IconGlobe size={16} />}
              onClick={() => setLocale("ar")}
            >
              {t("locale.ar")}
            </Button>
            <Button
              variant={locale === "en" ? "primary" : "secondary"}
              icon={<IconGlobe size={16} />}
              onClick={() => setLocale("en")}
            >
              {t("locale.en")}
            </Button>
          </div>
        </Card>
      </div>

      <Card padded elevated title={t("settings.ai.title") || "AI"}>
        <div className="amk-row" style={{ justifyContent: "space-between" }}>
          <span className="amk-muted">
            {aiEnabled ? t("settings.ai.enabled") || "AI is enabled" : t("settings.ai.disabled") || "AI is disabled by administrator"}
          </span>
        </div>
        {aiEnabled && (
          <>
            <p className="amk-muted">{t("settings.ai.provider") || "Provider"}: {import.meta.env.VITE_AI_PROVIDER || "ollama"}</p>
            <p className="amk-muted">{t("settings.ai.model") || "Model"}: {import.meta.env.VITE_AI_MODEL || "llama3.1:8b"}</p>
          </>
        )}
        <p className="amk-muted">{t("settings.ai.privacy_note") || "AI runs locally; no data leaves your device."}</p>
      </Card>

      <Card padded elevated title={t("settings.account")}>
        <div className="amk-row" style={{ justifyContent: "space-between" }}>
          <span className="amk-muted">{user?.email}</span>
          <Button variant="danger" icon={<IconLogout size={16} />} onClick={() => void logout()}>
            {t("actions.signOut")}
          </Button>
        </div>
      </Card>
    </div>
  )
}
