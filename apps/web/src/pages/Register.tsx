import { useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button, Card, Input } from "../design/components"
import { IconGlobe, IconMoon, IconSun } from "../design/icons"
import { useT } from "../design/i18n"
import { useTheme } from "../design/ThemeProvider"
import { useAuth } from "../state/AuthContext"

type Errors = {
  username?: string
  email?: string
  password?: string
  confirm?: string
  form?: string
}

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const t = useT()
  const { theme, locale, toggleTheme, toggleLocale } = useTheme()

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [errors, setErrors] = useState<Errors>({})
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    const next: Errors = {}
    if (!email.trim()) next.email = t("auth.emailRequired")
    if (!password) next.password = t("auth.passwordRequired")
    else if (password.length < 8) next.password = t("register.error.weak")
    if (password && confirm !== password) next.confirm = t("register.error.mismatch")
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setBusy(true)
    try {
      await register(email, username, password)
      navigate("/dashboard", { replace: true })
    } catch {
      setErrors({ form: t("common.error") })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="amk-auth">
      <div className="amk-auth-toggles">
        <button type="button" className="amk-iconbtn" onClick={toggleTheme} aria-label={t("theme.toggle")}>
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>
        <button type="button" className="amk-iconbtn" onClick={toggleLocale} aria-label={t("locale.toggle")}>
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
            {t("register.title")}
          </h1>
          <p className="amk-muted" style={{ textAlign: "center", margin: "4px 0 20px" }}>
            {t("register.subtitle")}
          </p>

          <form className="amk-stack" onSubmit={(e) => void onSubmit(e)} noValidate>
            <Input
              label={t("register.username")}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <Input
              label={t("register.email")}
              type="email"
              autoComplete="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
            <Input
              label={t("register.password")}
              type="password"
              autoComplete="new-password"
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              hint={t("register.hint")}
            />
            <Input
              label={t("register.confirm")}
              type="password"
              autoComplete="new-password"
              dir="ltr"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={errors.confirm}
            />
            {errors.form && (
              <div className="amk-field-error" role="alert">
                {errors.form}
              </div>
            )}
            <Button type="submit" fullWidth loading={busy}>
              {t("register.submit")}
            </Button>
          </form>

          <p className="amk-muted" style={{ textAlign: "center", marginTop: 20, fontSize: 13 }}>
            {t("register.haveAccount")} <Link to="/login">{t("register.loginLink")}</Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
