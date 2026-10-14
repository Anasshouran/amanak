import type { ApiError } from "@amanak/shared-types"
import { Button, Modal } from "../design/components"
import { useT } from "../design/i18n"

export type PaymentRequired = {
  feature?: string
  limit?: number
  used?: number
}

/**
 * Detect a 402 payment-required error from the API. 402 bodies carry
 * { feature, limit, used } at the top level (not under `code`).
 */
export function isPaymentRequired(err: unknown): boolean {
  if (!err || typeof err !== "object") return false
  const e = err as Partial<ApiError> & PaymentRequired
  if (e.status === 402) return true
  const code = String(e.code ?? "")
  return code === "payment_required" || code === "402"
}

export function paymentRequiredInfo(err: unknown): PaymentRequired {
  if (!err || typeof err !== "object") return {}
  const e = err as PaymentRequired
  return { feature: e.feature, limit: e.limit, used: e.used }
}

const FEATURE_KEYS: Record<string, string> = {
  scans: "usage.scans",
  ai: "nav.ai",
  ai_requests: "usage.ai_requests",
  awareness_sessions: "usage.awareness_sessions",
  monitored_emails: "usage.monitored_emails",
  password_entries: "usage.password_entries",
  two_factor_entries: "usage.two_factor_entries",
  family_members: "usage.family_members",
  export: "billing.title",
}

export function UpgradeModal({
  open,
  info,
  onClose,
}: {
  open: boolean
  info: PaymentRequired
  onClose: () => void
}) {
  const t = useT()
  const featureLabel = info.feature ? t(FEATURE_KEYS[info.feature] ?? info.feature) : ""

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("upgrade.title")}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t("upgrade.dismiss")}
          </Button>
          <Button
            onClick={() => {
              window.location.assign("/plans")
            }}
          >
            {t("upgrade.cta")}
          </Button>
        </>
      }
    >
      <p>{t("upgrade.description")}</p>
      {featureLabel && <p className="amk-muted">{featureLabel}</p>}
      {info.limit !== undefined && info.limit >= 0 && (
        <p className="amk-muted">
          {t("billing.used")}: {info.used ?? 0} / {t("billing.limit")}: {info.limit}
        </p>
      )}
    </Modal>
  )
}
