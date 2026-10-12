import type { ScanSeverity, ScanVerdict } from "@amanak/shared-types"
import type { BadgeVariant } from "../design/components"

const VERDICT_VARIANT: Record<ScanVerdict, BadgeVariant> = {
  safe: "success",
  suspicious: "warning",
  dangerous: "danger",
}

const SEVERITY_VARIANT: Record<ScanSeverity, BadgeVariant> = {
  low: "low",
  medium: "medium",
  high: "high",
  critical: "critical",
}

export function verdictVariant(verdict: ScanVerdict): BadgeVariant {
  return VERDICT_VARIANT[verdict] ?? "neutral"
}

export function severityVariant(severity: ScanSeverity): BadgeVariant {
  return SEVERITY_VARIANT[severity] ?? "neutral"
}
