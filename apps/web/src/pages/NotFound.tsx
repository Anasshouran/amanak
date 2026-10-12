import { Link } from "react-router-dom"
import { Button, EmptyState } from "../design/components"
import { IconAlert } from "../design/icons"
import { useT } from "../design/i18n"

export function NotFound() {
  const t = useT()
  return (
    <div className="amk-auth">
      <div className="amk-auth-card" style={{ maxWidth: 480 }}>
        <EmptyState
          icon={<IconAlert size={30} />}
          title={`404 · ${t("notfound.title")}`}
          description={t("notfound.description")}
          action={
            <Link to="/">
              <Button variant="primary">{t("notfound.back")}</Button>
            </Link>
          }
        />
      </div>
    </div>
  )
}
