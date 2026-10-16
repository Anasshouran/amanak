import type { ScanMatch } from "@amanak/shared-types"
import { Badge } from "../../design/components"
import { useT } from "../../design/i18n"
import { severityVariant } from "../../lib/labels"

export type IndicatorListProps = {
  matches: ScanMatch[]
}

export function IndicatorList({ matches }: IndicatorListProps) {
  const t = useT()
  if (matches.length === 0) {
    return <p className="amk-muted">{t("scanner.noMatches")}</p>
  }
  return (
    <div className="amk-match-list scan-match-list" role="region" aria-label={t("scanner.result.details.indicators")}>
      {matches.map((match, index) => (
        <details className="amk-match scan-match" key={`${match.rule_id}-${index}`}>
          <summary className="scan-match__summary">
            <span className="amk-mono scan-match__id">
              {t("scanner.match.rule")}: {match.rule_id}
            </span>
            <Badge variant={severityVariant(match.severity)}>{t(`scanner.severity.${match.severity}`)}</Badge>
          </summary>
          <div className="amk-match__body scan-match__body">
            <p>{match.description}</p>
          </div>
        </details>
      ))}
    </div>
  )
}
