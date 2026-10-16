import { useT } from "../../design/i18n"
import { useTheme } from "../../design/ThemeProvider"
import { formatDate } from "../../lib/format"
import { useAuth } from "../../state/AuthContext"

export type GreetingProps = {
  /** Injectable clock for deterministic tests. */
  now?: Date
}

function greetingKey(date: Date): string {
  const hour = date.getHours()
  if (hour < 12) return "dashboard.greeting.morning"
  if (hour < 18) return "dashboard.greeting.afternoon"
  return "dashboard.greeting.evening"
}

function displayName(username: string | undefined, email: string | undefined): string {
  const trimmed = username?.trim()
  if (trimmed) return trimmed
  const local = email?.split("@")[0]?.trim()
  return local || ""
}

export function Greeting({ now }: GreetingProps) {
  const t = useT()
  const { locale } = useTheme()
  const { user } = useAuth()
  const date = now ?? new Date()

  return (
    <header className="dash-greeting">
      <h1 className="dash-greeting__title">
        {t(greetingKey(date), { name: displayName(user?.username, user?.email) })}
      </h1>
      <p className="dash-greeting__subtitle">{t("dashboard.greeting.subtitle")}</p>
      <span className="dash-greeting__date">{formatDate(date.toISOString(), locale)}</span>
    </header>
  )
}
