import type { ComponentType } from "react"
import { Link } from "react-router-dom"
import { useT } from "../../design/i18n"
import {
  IconKey,
  IconPasswords,
  IconScanner,
  IconShield,
} from "../../design/icons"

export type ActionCardsProps = {
  /** Whether the breach monitor already has at least one monitored email. */
  breachEnabled: boolean
}

type ActionDef = {
  to: string
  titleKey: string
  descKey: string
  ctaKey: string
  icon: ComponentType<{ size?: number }>
  primary?: boolean
}

const ACTIONS: ActionDef[] = [
  {
    to: "/scanner",
    titleKey: "dashboard.actions.scan.title",
    descKey: "dashboard.actions.scan.desc",
    ctaKey: "dashboard.actions.scan.cta",
    icon: IconScanner,
    primary: true,
  },
  {
    to: "/breach",
    titleKey: "dashboard.actions.breach.title",
    descKey: "dashboard.actions.breach.desc",
    ctaKey: "dashboard.actions.breach.enable",
    icon: IconShield,
  },
  {
    to: "/vault",
    titleKey: "dashboard.actions.twofa.title",
    descKey: "dashboard.actions.twofa.desc",
    ctaKey: "dashboard.actions.twofa.cta",
    icon: IconKey,
  },
  {
    to: "/passwords",
    titleKey: "dashboard.actions.passwords.title",
    descKey: "dashboard.actions.passwords.desc",
    ctaKey: "dashboard.actions.passwords.cta",
    icon: IconPasswords,
  },
]

export function ActionCards({ breachEnabled }: ActionCardsProps) {
  const t = useT()

  return (
    <div className="dash-actions">
      {ACTIONS.map((action) => {
        const Icon = action.icon
        const ctaLabel =
          action.to === "/breach"
            ? t(breachEnabled ? "dashboard.actions.breach.check" : "dashboard.actions.breach.enable")
            : t(action.ctaKey)
        return (
          <Link key={action.to} to={action.to} className="dash-action">
            <span className="dash-action__icon" aria-hidden="true">
              <Icon size={20} />
            </span>
            <strong className="dash-action__title">{t(action.titleKey)}</strong>
            <span className="dash-action__desc">{t(action.descKey)}</span>
            <span
              className={`dash-action__cta${action.primary ? " dash-action__cta--primary" : ""}`}
            >
              {ctaLabel}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
