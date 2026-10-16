import type { ComponentType } from "react"
import { Link } from "react-router-dom"
import { Card } from "../../design/components"
import { useT } from "../../design/i18n"
import { IconDevices, IconKey, IconPlus, IconSparkles } from "../../design/icons"

type QuickAction = {
  to: string
  labelKey: string
  icon: ComponentType<{ size?: number }>
}

const QUICK_ACTIONS: QuickAction[] = [
  { to: "/accounts", labelKey: "dashboard.quick.addAccount", icon: IconPlus },
  { to: "/devices", labelKey: "dashboard.quick.addDevice", icon: IconDevices },
  {
    to: "/passwords?action=generate",
    labelKey: "dashboard.quick.generatePassword",
    icon: IconSparkles,
  },
  { to: "/vault?action=add", labelKey: "dashboard.quick.setup2fa", icon: IconKey },
]

export function QuickActions() {
  const t = useT()

  return (
    <Card padded elevated className="dash-quick" title={t("dashboard.quick.title")}>
      <div className="dash-quick__list">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <Link key={action.to} to={action.to} className="dash-quick__item">
              <Icon size={16} />
              <span>{t(action.labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </Card>
  )
}
