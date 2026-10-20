import { useT } from "../design/i18n"
import { useContext_ } from "../state/ContextProvider"

/**
 * Small pill showing the active tenant context (P18.1c2).
 *
 * Neutral for the personal context, brand-tinted for an organization. Placed at
 * the top of every data page (not on auth / landing / staff pages).
 */
export function ContextBadge() {
  const t = useT()
  const { contextId, contextName } = useContext_()
  const isOrg = contextId !== null

  return (
    <div className={`amk-contextbadge${isOrg ? " amk-contextbadge--org" : ""}`}>
      <span aria-hidden="true">{isOrg ? "🏢" : "🏠"}</span>
      <span>{isOrg ? contextName : t("context.personal")}</span>
    </div>
  )
}
