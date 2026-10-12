/** Shared TypeScript contracts for AMANAK mobile, web, and API client. */

export type User = {
  id: number
  email: string
  username: string
  is_verified: boolean
  created_at: string
  updated_at: string
}

export type AuthTokens = {
  access: string
  refresh: string
}

export type AuthResponse = {
  user: User
  tokens: AuthTokens
}

export type SecurityScore = {
  id: number
  score: number
  computed_at: string
  last_scanned: string | null
}

export type DashboardOverview = {
  accounts: number
  devices: number
  open_incidents: number
  security_score: number
}

export type Account = {
  id: number
  service_name: string
  username: string
  notes: string
  created_at: string
  updated_at: string
}

export type AccountInput = {
  service_name: string
  username?: string
  notes?: string
}

export type Device = {
  id: number
  device_name: string
  device_type: string
  platform: string
  last_reported: string
  notes: string
}

export type DeviceInput = {
  device_name: string
  device_type?: string
  platform?: string
  notes?: string
}

export type Incident = {
  id: number
  title: string
  description: string
  incident_type: string
  reported_at: string
  resolved: boolean
}

export type IncidentInput = {
  title: string
  description?: string
  incident_type?: string
}

export type ApiError = {
  code: string
  message: string
  details?: Record<string, unknown>
}

export type ScanVerdict = "safe" | "suspicious" | "dangerous"

export type ScanSeverity = "low" | "medium" | "high" | "critical"

export type ScanKind = "url" | "message"

export type ScanMatch = {
  rule_id: string
  severity: ScanSeverity
  description: string
  evidence_redacted: string
}

export type ScanRequest = {
  input: string
  context?: Record<string, unknown> | null
}

export type ScanResponse = {
  verdict: ScanVerdict
  score: number
  matches: ScanMatch[]
  ruleset_version: string
  scanned_at: string
}

export type ScanResultRecord = {
  id: number
  kind: ScanKind
  verdict: ScanVerdict
  score: number
  matches: ScanMatch[]
  ruleset_version: string
  preview: string
  created_at: string
}

export type AIKind = "explain_scan" | "guidance"

export type AITopic = "phishing" | "passwords" | "2fa" | "general"

export type AILocale = "ar" | "en"

export type AIRequest = {
  scan_id?: string
  locale?: AILocale
  topic?: AITopic
}

export type AIProviderName = "null" | "fake" | "openai" | "anthropic"

export type AIResponse = {
  text: string
  provider: AIProviderName
  model: string
  tokens_used: number
}

// ---- Breach monitor (P7). Opt-in, privacy-preserving, disabled by default. ----

export type MonitoredEmail = {
  id: number
  email: string
  label: string
  is_active: boolean
  consent_given_at: string
  created_at: string
  updated_at: string
}

export type BreachHit = {
  id: number
  monitored_email: number
  email: string
  name: string
  domain: string
  breach_date: string
  pwn_count: number | null
  data_classes: string[]
  is_verified: boolean
  first_seen_at: string
  last_checked_at: string
}

export type CheckSummary = {
  checked: number
  hits_new: number
  hits_total: number
}

export type BreachConsentPayload = {
  email: string
  label?: string
  consent: boolean
}