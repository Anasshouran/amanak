import type { ScanMatch, ScanVerdict } from "@amanak/shared-types"
import { Badge, Button, Card } from "../../design/components"
import type { BadgeVariant } from "../../design/components"
import { IconCheck, IconClose, IconAlert } from "../../design/icons"
import { useT } from "../../design/i18n"
import { verdictVariant } from "../../lib/labels"
import { IndicatorList } from "./IndicatorList"

export type ScanResultView = {
  verdict: ScanVerdict
  score: number
  matches: ScanMatch[]
  rulesetVersion: string
  input: string
  scannedAt: string
  scanId?: number
}

export type ScanResultProps = {
  result: ScanResultView
  onScanAnother?: () => void
  onCopyReport?: () => void
  onReportFalsePositive?: () => void
  onExplain?: (scanId: number) => void
  aiEnabled?: boolean
  explanation?: string | null
  explainBusy?: boolean
  explainError?: string | null
}

function StatusIcon({ verdict }: { verdict: ScanVerdict }) {
  switch (verdict) {
    case "safe":
      return (
        <span className="scan-status__icon scan-status__icon--safe" aria-hidden="true">
          <IconCheck size={28} />
        </span>
      )
    case "suspicious":
      return (
        <span className="scan-status__icon scan-status__icon--suspicious" aria-hidden="true">
          <IconAlert size={28} />
        </span>
      )
    default:
      return (
        <span className="scan-status__icon scan-status__icon--dangerous" aria-hidden="true">
          <IconClose size={28} />
        </span>
      )
  }
}

export function ScanResult({ result, onScanAnother, onCopyReport, onReportFalsePositive, onExplain, aiEnabled = false, explanation = null, explainBusy = false, explainError = null }: ScanResultProps) {
  const t = useT()
  const verdict = result.verdict
  const statusKey = verdict === "dangerous" ? "dangerous" : verdict
  const subtitle = `scanner.result.subtitle.${statusKey}`

  function domainOf(input: string) {
    try {
      const u = new URL(input)
      return u.hostname
    } catch {
      return t("scanner.result.domainUnknown")
    }
  }

  function riskLevel(v: ScanVerdict): { key: BadgeVariant; label: string } {
    if (v === "safe") return { key: "low", label: t("scanner.severity.low") }
    if (v === "suspicious") return { key: "medium", label: t("scanner.severity.medium") }
    return { key: "high", label: t("scanner.severity.high") }
  }

  const rl = riskLevel(verdict)
  const verdictBadge = verdictVariant(verdict)

  return (
    <section className="scan-result-card" role="status" aria-live="polite" data-verdict={verdict}>
      <div className="scan-result__header">
        <div className="scan-result__status">
          <StatusIcon verdict={verdict} />
          <div className="scan-result__status-text">
            <h2 className="scan-result__title">{t(`scanner.status.${statusKey}`)}</h2>
            <p className="scan-result__subtitle">{t(subtitle)}</p>
          </div>
        </div>
        <Badge variant={verdictBadge}>{t(`scanner.verdict.${verdict}`)}</Badge>
      </div>

      <div className="scan-result__details">
        <div className="scan-detail-row">
          <dt className="scan-detail__label">{t("scanner.result.details.url")}</dt>
          <dd className="scan-detail__value">
            <span dir="ltr" className="amk-mono scan-detail__url">
              {result.input}
            </span>
          </dd>
        </div>
        <div className="scan-detail-row">
          <dt className="scan-detail__label">{t("scanner.result.details.domain")}</dt>
          <dd className="scan-detail__value">
            <span dir="ltr" className="amk-mono">
              {domainOf(result.input)}
            </span>
          </dd>
        </div>
        <div className="scan-detail-row">
          <dt className="scan-detail__label">{t("scanner.result.details.category")}</dt>
          <dd className="scan-detail__value">{t("scanner.result.notEnoughData")}</dd>
        </div>
        <div className="scan-detail-row">
          <dt className="scan-detail__label">{t("scanner.result.details.riskLevel")}</dt>
          <dd className="scan-detail__value">
            <Badge variant={rl.key}>{rl.label}</Badge>
          </dd>
        </div>
      </div>

      <div className="scan-result__indicators">
        <h3 className="scan-result__indicators-title">{t("scanner.result.details.indicators")}</h3>
        <IndicatorList matches={result.matches} />
      </div>

      <div className="scan-result__actions">
        {onScanAnother && (
          <Button type="button" variant="secondary" onClick={onScanAnother}>
            {t("scanner.action.scanAnother")}
          </Button>
        )}
        {onCopyReport && (
          <Button type="button" variant="secondary" onClick={onCopyReport}>
            {t("scanner.action.copyReport")}
          </Button>
        )}
        {verdict !== "safe" && onReportFalsePositive && (
          <Button type="button" variant="ghost" onClick={onReportFalsePositive}>
            {t("scanner.action.reportFalsePositive")}
          </Button>
        )}
        {onExplain && result.scanId != null && (
          <Button
            type="button"
            variant="secondary"
            disabled={!aiEnabled || explainBusy}
            title={!aiEnabled ? t("scanner.explain.disabled") : undefined}
            onClick={() => onExplain(result.scanId as number)}
          >
            {explainBusy ? t("scanner.explain.loading") : t("scanner.explain.button")}
          </Button>
        )}
      </div>

      {explanation && (
        <Card padded elevated className="scan-explanation-card">
          <h3>{t("scanner.explain.title") || "AI Explanation"}</h3>
          <p>{explanation}</p>
          <p className="amk-muted">{t("scanner.explain.powered_by")}</p>
        </Card>
      )}
      {explainError && (
        <p className="amk-muted" role="alert">{explainError}</p>
      )}
    </section>
  )
}
