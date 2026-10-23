/** Shared TypeScript contracts for AMANAK mobile, web, and API client. */

export interface OrgUsage {
  plan: string
  members: { used: number; limit: number }
  devices: { used: number; limit: number }
  incidents: { used: number; limit: number }
  ai_requests: { used: number; limit: number }
}

export type User = {
  id: number
  email: string
  username: string
  display_name?: string
  locale?: "ar" | "en"
  is_verified: boolean
  created_at: string
  updated_at: string
  is_staff?: boolean
  roles?: string[]
}

/** Body for `PATCH /me/`. Only these fields may change (P17.7b). */
export type UpdateMeInput = {
  display_name?: string
  locale?: "ar" | "en"
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

export type ScoreHistoryPoint = {
  date: string
  score: number
}

export type ScoreHistoryRange = "7d" | "30d" | "90d"

export type ScoreHistoryResponse = {
  range: ScoreHistoryRange
  from: string
  to: string
  points: ScoreHistoryPoint[]
  current: number
  delta: number
  trend: "up" | "down" | "flat"
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

export type Organization = {
  id: string
  name: string
  slug: string
  role?: string
  created_at?: string
}

export type OrganizationOverview = {
  organization: { id: string; name: string; slug: string }
  member_count: number
  device_count: number
  open_incident_count: number
  security_score: number
  recent_activity: number
  recent_devices: OrgDeviceSummary[]
  recent_incidents: OrgIncidentSummary[]
}

export type ApiError = {
  code: string
  message: string
  details?: Record<string, unknown>
  /** HTTP status, when the failure came from the server. */
  status?: number
  /** Present on 402 payment-required responses. */
  feature?: string
  limit?: number
  used?: number
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
  id?: number
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

// ---- Two-factor manager (P8). Server-blind: blobs are opaque base64. ----

export type TwoFactorProfile = {
  id: number
  kdf_salt: string
  kdf_iterations: number
  kdf_algorithm: string
  created_at: string
  updated_at: string
}

export type TwoFactorEntry = {
  id: number
  label: string
  issuer: string
  ciphertext: string
  iv: string
  created_at: string
  updated_at: string
}

export type TwoFactorCreateEntryInput = {
  label: string
  issuer?: string
  ciphertext: string
  iv: string
}

export type TwoFactorUpdateEntryInput = Partial<{
  label: string
  issuer: string
  ciphertext: string
  iv: string
}>

// ---- Password manager (P9). Server-blind: metadata is plaintext, secrets are
// ---- an opaque base64 blob the server can never decrypt. ----

export const PASSWORD_CATEGORIES = [
  "general",
  "email",
  "banking",
  "social",
  "work",
  "shopping",
  "entertainment",
  "developer",
  "government",
  "other",
] as const

export type PasswordCategory = (typeof PASSWORD_CATEGORIES)[number]

export type PasswordVaultProfile = {
  id: number
  kdf_salt: string
  kdf_iterations: number
  kdf_algorithm: string
  verification_ciphertext: string
  verification_iv: string
  created_at: string
  updated_at: string
}

export type PasswordCreateProfileInput = {
  kdf_salt: string
  verification_ciphertext: string
  verification_iv: string
}

export type PasswordEntry = {
  id: number
  title: string
  username: string
  url: string
  category: string
  tags: string[]
  ciphertext: string
  iv: string
  created_at: string
  updated_at: string
}

export type PasswordCreateEntryInput = {
  title: string
  username?: string
  url?: string
  category?: string
  tags?: string[]
  ciphertext: string
  iv: string
}

export type PasswordUpdateEntryInput = Partial<{
  title: string
  username: string
  url: string
  category: string
  tags: string[]
  ciphertext: string
  iv: string
}>

// ---- Family Protection (P10). Opt-in sharing, server-blind aggregate. ----

export type FamilyRole = "guardian" | "member"

export type Family = {
  id: number
  name: string
  guardian: { user_id: number; display_name: string }
  role: FamilyRole
  created_at: string
  updated_at: string
}

export type FamilyInvitation = {
  id: number
  invited_email: string
  token: string
  created_at: string
  expires_at: string
  accepted_at: string | null
}

export type FamilyInvitationCreateInput = {
  invited_email: string
}

export type FamilyInvitationAcceptInput = {
  token: string
  confirm?: boolean
}

export type FamilyTransferInput = {
  to_user_id: number
}

export type FamilyDeleteInput = {
  account_password: string
}

export type FamilyMemberSummary = {
  user_id: number
  display_name: string
  role: FamilyRole
  joined_at: string
  security_score: number
  shared?: {
    incidents?: { high_severity_count: number; titles: string[] }
    devices?: { count: number; last_seen: string | null }
    breach?: { hit_count: number }
    scans?: { total: number; verdicts: { safe: number; suspicious: number; dangerous: number } }
  }
}

export type FamilyMe = {
  user_id: number
  display_name: string
  role: FamilyRole
  family_id: number
  family_name: string
  joined_at: string
  share_incidents: boolean
  share_devices: boolean
  share_breach: boolean
  share_scans: boolean
  security_score: number
}

export type FamilyAlert = {
  id: number
  member: number
  kind: "incident_high_severity"
  summary: string
  severity: string
  created_at: string
  seen_at: string | null
}

export type FamilyShareToggles = {
  share_incidents?: boolean
  share_devices?: boolean
  share_breach?: boolean
  share_scans?: boolean
}

// Phishing Awareness (P11)
export type AwarenessAnswer = "safe" | "phishing" | "unsure"

export type AwarenessOption = {
  id: string
  label: { ar: string; en: string } | Record<string, string>
}

export type AwarenessScenario = {
  id: string
  category: "email" | "sms" | "url" | "qr" | string
  difficulty: number
  locale: string
  title?: { ar: string; en: string } | Record<string, string>
  prompt?: { ar: string; en: string } | Record<string, string>
  options: AwarenessOption[]
}

export type AwarenessProgress = {
  total_attempts: number
  correct_attempts: number
  accuracy: number
  streak_current: number
  streak_best: number
  badges: string[]
}

export type AwarenessAnswerResponse = {
  is_correct: boolean
  explanation?: { ar: string; en: string } | Record<string, string>
  red_flags?: string[]
  scanner_rule_refs?: string[]
  progress: AwarenessProgress
}

export type AwarenessCategory = {
  id: string
  count_easy: number
  count_medium: number
  count_hard: number
  attempted: number
  correct: number
}

// Subscription Tiers (P12)
export type PlanId = "free" | "pro" | "family" | "business" | "enterprise" | string

export type PlanLimits = {
  scans_per_month: number
  monitored_emails: number
  password_entries: number
  two_factor_entries: number
  family_members: number
  ai_enabled: boolean
  ai_requests_per_month: number
  awareness_sessions_per_month: number
  export_enabled: boolean
  support_level: "community" | "email" | "priority" | string
}

export type Plan = {
  id: PlanId
  name_en: string
  name_ar: string
  price_monthly: string | number | null
  price_yearly: string | number | null
  currency: string
  limits: PlanLimits
  is_active: boolean
  audience?: "personal" | "family" | "business" | "enterprise"
  seats_included?: number | null
  price_note?: string
  is_available?: boolean
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired"
export type BillingPeriod = "monthly" | "yearly"

export type Subscription = {
  id: number
  plan: Plan
  status: SubscriptionStatus
  period: BillingPeriod
  current_period_start: string
  current_period_end: string
  cancel_at_period_end: boolean
  provider: string
}

export type UsageEntry = { used: number; limit: number }

export type BillingUsage = {
  scans: UsageEntry
  ai_requests: UsageEntry
  awareness_sessions: UsageEntry
  monitored_emails: UsageEntry
  password_entries: UsageEntry
  two_factor_entries: UsageEntry
  family_members: UsageEntry
  ai_enabled: boolean
  export_enabled: boolean
}

export type PlanChangeResponse = {
  kind: "manual" | "redirect"
  checkout_url: string | null
  subscription: Subscription
}

// ---- staff / moderation / tickets (P13.1 API, consumed by P13.2 UI) ----

export type Paginated<T> = {
  count: number
  page: number
  pages: number
  results: T[]
}

export type StaffUser = {
  id: number
  email: string
  username: string
  is_verified: boolean
  is_active: boolean
  is_staff: boolean
  date_joined: string | null
  plan?: string | null
  is_blocked?: boolean
  tickets_count?: number
}

export type StaffSubscription = {
  plan: string | null
  status: string | null
  current_period_end: string | null
}

export type StaffUsageSlice = { used: number; limit: number }

export type StaffUsage = {
  scans: StaffUsageSlice
  ai_requests: StaffUsageSlice
}

export type StaffModeration = { is_blocked: boolean; reason: string }

export type StaffCounts = {
  scans_total: number
  incidents_total: number
  vault_entries: number
  "2fa_entries": number
}

export type StaffUserSnapshot = {
  user: StaffUser
  subscription: StaffSubscription
  usage_this_month: StaffUsage
  moderation: StaffModeration
  counts: StaffCounts
}

export type SupportTicket = {
  id: number
  user: number
  user_email: string | null
  subject: string
  status: string
  priority: string
  assigned_to: number | null
  created_at: string
  updated_at: string
}

export type SupportTicketDetail = SupportTicket & {
  body: string
  messages: SupportTicketMessage[]
}

export type SupportTicketMessage = {
  id: number
  author: number | null
  author_email: string | null
  is_staff: boolean
  body: string
  created_at: string
}

export type AdminActionLogEntry = {
  id: number
  actor: number | null
  actor_email: string | null
  action: string
  target_user: number | null
  target_type: string
  target_id: string
  before: unknown
  after: unknown
  reason: string
  ip: string | null
  user_agent: string
  created_at: string
}

// ---- advanced admin (P13.3) ----

export type ImpersonationStartResponse = {
  session_id: number
  expires_at: string
  target: { id: number; email: string }
}

export type StaffSubscriptionRow = {
  user_id: number
  email: string
  username: string
  plan: string
  status: string
  period: string
  current_period_end: string | null
  cancel_at_period_end: boolean
  provider: string
}

export type AnnouncementAudience =
  | { all: true }
  | { verified: true }
  | { plan: string }

export type StaffAnnouncement = {
  id: number
  subject: string
  body: string
  audience: Record<string, unknown>
  sent_at: string | null
  created_at: string
  recipient_count: number
  author_email: string | null
}

export type NotificationItem = {
  id: number
  subject: string
  body: string
  read: boolean
  created_at: string
}

export type NotificationList = {
  unread: number
  count: number
  results: NotificationItem[]
}

/** The five user-facing notification toggles (P17.7b). */
export type NotificationPreferences = {
  security_alerts: boolean
  breach_alerts: boolean
  scan_results: boolean
  family_activity: boolean
  product_updates: boolean
}

export type ExportRequestResponse = {
  token: string
  url: string
  expires_at: string
}

/** Response from `POST /me/export/` — a one-time self-service download (P17.7b). */
export type UserExportResponse = {
  token: string
  download_url: string
  expires_at: string
}

export interface OrgDeviceSummary {
  id: string
  name: string
  os: string
  type: string
  last_seen: string
}

export interface OrgIncidentSummary {
  id: string
  title: string
  severity: "low" | "medium" | "high" | "critical"
  status: string
  created_at: string
}

export interface OrgMemberRow {
  user_id: number
  email: string
  display_name?: string
  role: "owner" | "admin" | "analyst" | "employee" | "auditor"
  joined_at: string
  last_active_at?: string | null
}

export interface OrgActivityRow {
  type: "incident_created" | "device_added" | "member_joined"
  title: string
  severity?: string | null
  actor_email?: string | null
  created_at: string | null
}

export interface MyInvitation {
  id: number;
  organization: { id: string; name: string; slug: string };
  role: string;
  invited_by_email: string;
  created_at: string;
  expires_at: string;
}

export interface OrgAuditEntry {
  id: number;
  action: string;
  actor: { id: number; email: string } | null;
  target_type: string;
  target_id: string;
  target_email: string;
  metadata: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}
export interface OrgAuditResponse {
  count: number;
  results: OrgAuditEntry[];
}
