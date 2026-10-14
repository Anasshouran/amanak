import type { BillingUsage, Plan, PlanLimits, UsageEntry } from "@amanak/shared-types"

export function isUnlimited(limit: number): boolean {
  return limit < 0
}

export function isIncluded(limit: number): boolean {
  return limit !== 0
}

export function formatLimit(limit: number, t: (key: string) => string): string {
  if (limit < 0) return t("billing.unlimited")
  if (limit === 0) return t("billing.not_included")
  return String(limit)
}

export function formatPrice(
  plan: Plan,
  period: "monthly" | "yearly",
): string {
  const value = period === "yearly" ? plan.price_yearly : plan.price_monthly
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric === 0) return "0"
  return numeric.toFixed(2)
}

export type LimitRow = {
  key: keyof PlanLimits
  labelKey: string
  boolean?: boolean
}

export const LIMIT_ROWS: LimitRow[] = [
  { key: "scans_per_month", labelKey: "usage.scans" },
  { key: "monitored_emails", labelKey: "usage.monitored_emails" },
  { key: "password_entries", labelKey: "usage.password_entries" },
  { key: "two_factor_entries", labelKey: "usage.two_factor_entries" },
  { key: "family_members", labelKey: "usage.family_members" },
  { key: "awareness_sessions_per_month", labelKey: "usage.awareness_sessions" },
  { key: "ai_enabled", labelKey: "nav.ai", boolean: true },
]

export type UsageRow = {
  key: UsageEntryKey
  labelKey: string
}

export type UsageEntryKey =
  | "scans"
  | "monitored_emails"
  | "password_entries"
  | "two_factor_entries"
  | "family_members"
  | "awareness_sessions"
  | "ai_requests"

export const USAGE_ROWS: UsageRow[] = [
  { key: "scans", labelKey: "usage.scans" },
  { key: "monitored_emails", labelKey: "usage.monitored_emails" },
  { key: "password_entries", labelKey: "usage.password_entries" },
  { key: "two_factor_entries", labelKey: "usage.two_factor_entries" },
  { key: "family_members", labelKey: "usage.family_members" },
  { key: "awareness_sessions", labelKey: "usage.awareness_sessions" },
  { key: "ai_requests", labelKey: "usage.ai_requests" },
]

export function usageEntry(usage: BillingUsage | null, key: UsageEntryKey): UsageEntry {
  if (!usage) return { used: 0, limit: 0 }
  const entry = usage[key]
  if (entry && typeof entry === "object" && "used" in entry) return entry
  return { used: 0, limit: 0 }
}

export function usagePercent(entry: UsageEntry | undefined): number | null {
  if (!entry) return null
  if (isUnlimited(entry.limit)) return null
  if (entry.limit === 0) return 0
  return Math.min(100, Math.round((entry.used / entry.limit) * 100))
}
