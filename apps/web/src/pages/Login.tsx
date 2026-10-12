import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button, Card, Input } from "../design/components"
import { IconGlobe, IconMoon, IconSun } from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { useAuth } from "../state/AuthContext"

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const { theme, locale, toggleTheme, toggleLocale } = useTheme()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: typeof errors = {}
    if (!email.trim()) next.email = t("auth.emailRequired")
    if (!password) next.password = t("auth.passwordRequired")
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setBusy(true)
    try {
      await login(email, password)
      navigate("/", { replace: true })
    } catch {
      setErrors({ form: t("login.error.invalid") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="amk-auth">
      <div className="amk-auth-toggles">
        <button
          type="button"
          className="amk-iconbtn"
          onClick={toggleTheme}
          aria-label={t("theme.toggle")}
        >
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        <button
          type="button"
          className="amk-iconbtn"
          onClick={toggleLocale}
          aria-label={t("locale.toggle")}
        >
          <IconGlobe />
        </button>
      </div>

      <div className="amk-auth-card">
        <Card padded elevated>
          <div className="amk-brand-mark" style={{ justifyContent: "center", marginBottom: 12 }}>
            <span className="amk-brand-mark__dot" aria-hidden="true" />
            <span>{t("brand.name")}</span>
          </div>
          <h1 style={{ fontSize: 22, textAlign: "center", color: "var(--c-text-strong)" }}>
            {t("login.title")}
          </h1>
          <p className="amk-muted" style={{ textAlign: "center", margin: "4px 0 20px" }}>
            {t("login.subtitle")}
          </p>

          <form className="amk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
            <Input
              label={t("login.email")}
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Input
              label={t("login.password")}
              type="password"
              autoComplete="current-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
            />
            {errors.form && (
              <div className="amk-field-error" role="alert">
                {errors.form}
              </div>
            )}
            <Button type="submit" fullWidth loading={busy}>
              {t("login.submit")}
            </Button>
          </form>

          <div
            className="amk-row"
            style={{ justifyContent: "space-between", marginTop: 20, fontSize: 13 }}
          >
            <Link to="/forgot">{t("login.forgot")}</Link>
            <span className="amk-muted">
              {t("login.noAccount")} <Link to="/register">{t("login.registerLink")}</Link>
            </span>
          </div>
        </Card>
      </div>
    </div>
  )
}
