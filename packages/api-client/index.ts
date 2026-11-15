/**
 * Typed API client for AMANAK.
 *
 * Error shape: { code, message, details } is preserved from the backend so
 * callers can branch on stable error codes.
 */

import type {
  Account,
  AccountInput,
  AIResponse,
  AIConversation,
  AIConversationDetail,
  AIMessage,
  AITopic,
  ApiError,
  AuthResponse,
  AuthTokens,
  OrgUsage,
  BreachConsentPayload,
  BreachHit,
  BillingPeriod,
  BillingUsage,
  CheckSummary,
  DashboardOverview,
  Device,
  DeviceInput,
  Family,
  FamilyAlert,
  FamilyInvitation,
  FamilyInvitationAcceptInput,
  FamilyInvitationCreateInput,
  FamilyMe,
  FamilyMemberSummary,
  FamilyShareToggles,
  FamilyTransferInput,
  FamilyDeleteInput,
  Incident,
  IncidentInput,
  MonitoredEmail,
  PasswordCreateEntryInput,
  PasswordCreateProfileInput,
  PasswordEntry,
  PasswordUpdateEntryInput,
  PasswordVaultProfile,
  Plan,
  PlanChangeResponse,
  PlanId,
  ScanResponse,
  ScanResultRecord,
  ScoreHistoryRange,
  ScoreHistoryResponse,
  SecurityScore,
  Subscription,
  TwoFactorCreateEntryInput,
  TwoFactorEntry,
  TwoFactorProfile,
  TwoFactorUpdateEntryInput,
  User,
  AdminActionLogEntry,
  Paginated,
  StaffModeration,
  StaffUser,
  StaffUserSnapshot,
  SupportTicket,
  SupportTicketDetail,
  SupportTicketMessage,
  AnnouncementAudience,
  ExportRequestResponse,
  ImpersonationStartResponse,
  NotificationItem,
  NotificationList,
  NotificationPreferences,
  StaffAnnouncement,
  StaffSubscriptionRow,
  UpdateMeInput,
  UserExportResponse,
  Organization,
  OrganizationOverview,
  OrgActivityRow,
  OrgAuditEntry,
  OrgAuditResponse,
  OrgMemberRow,
  MyInvitation,
  AISettings,
  APIKeyStatus,
  AITestResult,
  AIProviderOption,
} from "@amanak/shared-types"

export type { ApiError }

/**
 * Active tenant context (P18.1c2).
 *
 * `null` means the personal context. Every request carries an `X-Context-Id`
 * header — `"personal"` is sent explicitly (rather than omitting the header) so
 * the backend's `resolve_context` never falls back to a different default.
 */
let currentContextId: string | null = null

export function setContextId(id: string | null): void {
  currentContextId = id
}

export function getContextId(): string | null {
  return currentContextId
}

export type TokenStore = {
  getAccessToken: () => Promise<string | null>
  getRefreshToken: () => Promise<string | null>
  setTokens: (tokens: AuthTokens) => Promise<void>
  clear: () => Promise<void>
}

export type ApiClientOptions = {
  /**
   * Fetch credentials mode. Web uses "include" so the HttpOnly refresh
   * cookie is sent to (and set by) the auth endpoints.
   */
  credentials?: RequestCredentials
  /**
   * Obtain a fresh access token when a request is rejected with 401. Web
   * implements this via the HttpOnly refresh cookie; mobile omits it.
   */
  refreshAccess?: () => Promise<string | null>
  /** Called when refreshing fails so the app can redirect to login. */
  onUnauthorized?: () => void
  /** Called for every 403 so callers can react (e.g. end an impersonation). */
  onForbidden?: (error: ApiError) => void
  /**
   * Returns the active impersonation target, if any. When set, every request
   * carries the ``X-Impersonate-User-Id`` header so the backend serves the
   * target's (read-only) view.
   */
  getImpersonation?: () => { userId: number } | null
}

export class ApiClient {
  private baseUrl: string
  private readonly tokens: TokenStore
  private readonly options: ApiClientOptions
  private refreshing: Promise<string | null> | null = null

  constructor(baseUrl: string, tokens: TokenStore, options: ApiClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.tokens = tokens
    this.options = options
  }

  /**
   * Repoint this client at another host.
   *
   * The mobile app bakes its API base URL at build time, which makes every
   * server move (a new tunnel URL, a self-hosted instance) require a rebuild.
   * The override screen calls this instead, so a new URL takes effect without
   * reinstalling. Tokens are kept: the same account is expected on the new host.
   */
  setBaseUrl(baseUrl: string): void {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
  }

  /** The URL every request is currently sent to. */
  getBaseUrl(): string {
    return this.baseUrl
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retried = false,
  ): Promise<T> {
    const access = await this.tokens.getAccessToken()
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      // Always sent: "personal" explicitly marks the personal context so the
      // backend does not fall back to a different resolution (P18.1c2).
      "X-Context-Id": currentContextId ?? "personal",
    }
    if (access) {
      headers.Authorization = `Bearer ${access}`
    }
    const impersonation = this.options.getImpersonation?.()
    if (impersonation) {
      headers["X-Impersonate-User-Id"] = String(impersonation.userId)
    }

    const init: RequestInit = {
      method,
      headers,
      credentials: this.options.credentials,
    }
    const methodUpper = method.toUpperCase()
    if (body !== undefined && methodUpper !== "GET" && methodUpper !== "HEAD") {
      init.body = JSON.stringify(body)
    }
    const res = await fetch(`${this.baseUrl}/api/v1${path}`, init)

    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      // non-JSON body
    }

    if (!res.ok) {
      // On an expired access token, try a single transparent refresh + retry.
      if (res.status === 401 && !retried && this.options.refreshAccess) {
        const newAccess = await this.refreshOnce()
        if (newAccess) {
          return this.request<T>(method, path, body, true)
        }
        this.options.onUnauthorized?.()
      } else if (res.status === 401) {
        this.options.onUnauthorized?.()
      }

      const error = (data ?? {}) as Partial<ApiError> & {
        detail?: string
        [key: string]: unknown
      }
      const apiError: ApiError = {
        code: error.code ?? String(res.status),
        message:
          error.message ??
          error.detail ??
          (typeof data === "object" && data && "detail" in error
            ? String(error.detail)
            : "Request failed"),
        details: error.details,
        status: res.status,
      }
      if (res.status === 402) {
        apiError.feature = error.feature
        apiError.limit = error.limit
        apiError.used = error.used
      }
      if (res.status === 403) {
        this.options.onForbidden?.(apiError)
      }
      throw apiError
    }

    return data as T
  }

  private refreshOnce(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = this.options
        .refreshAccess!()
        .finally(() => {
          this.refreshing = null
        })
    }
    return this.refreshing
  }

  // ---- auth ----
  register(email: string, username: string, password: string) {
    return this.request<AuthResponse>("POST", "/auth/register/", {
      email,
      username,
      password,
    })
  }

  async login(email: string, password: string) {
    const res = await this.request<AuthResponse>("POST", "/auth/login/", {
      email,
      password,
    })
    await this.tokens.setTokens(res.tokens)
    return res
  }

  async logout() {
    const refresh = await this.tokens.getRefreshToken()
    try {
      await this.request<{ status: string }>(
        "POST",
        "/auth/logout/",
        refresh ? { refresh } : undefined,
      )
    } catch {
      // Logout must be best-effort: still clear local state on failure.
    }
    await this.tokens.clear()
  }

  async me() {
    return this.request<User>("GET", "/me/")
  }

  /** Partially update the caller's own profile (P17.7b). */
  updateProfile(input: UpdateMeInput) {
    return this.request<User>("PATCH", "/me/", input)
  }

  /** Read the caller's notification preferences (P17.7b). */
  getNotificationPreferences() {
    return this.request<NotificationPreferences>("GET", "/notifications/preferences/")
  }

  /** Update one or more notification toggles (P17.7b). */
  updateNotificationPreferences(input: Partial<NotificationPreferences>) {
    return this.request<NotificationPreferences>(
      "PATCH",
      "/notifications/preferences/",
      input,
    )
  }

  /** Request a one-time token to download the caller's own data (P17.7b). */
  requestMyExport() {
    return this.request<UserExportResponse>("POST", "/me/export/")
  }

  /** Download a previously requested self-service export (single-use). */
  downloadMyExport(token: string) {
    return this.request<Record<string, unknown>>("GET", `/me/export/${token}/`)
  }

  // ---- push notifications (P20.1) ----
  registerPushToken(input: { token: string; platform: string; device_id?: string }) {
    return this.request<{ id: number; token: string }>("POST", "/me/push-tokens/", input)
  }

  unregisterPushToken(id: number) {
    return this.request<null>("DELETE", `/me/push-tokens/${id}/`)
  }

  listPushTokens() {
    return this.request<any[]>("GET", "/me/push-tokens/")
  }

  // ---- account compromise detection (P19.1) ----
  getSessions() {
    return this.request<any[]>("GET", "/me/sessions/")
  }

  getActivity(limit: number = 50) {
    return this.request<any[]>("GET", `/me/activity/?limit=${limit}`)
  }

  revokeAllSessions() {
    return this.request<{ revoked: number }>("POST", "/me/sessions/revoke-all/")
  }

  getAlerts() {
    return this.request<any[]>("GET", "/me/alerts/")
  }

  markAlertRead(id: number) {
    return this.request<{ status: string }>("POST", `/me/alerts/${id}/read/`)
  }

  // ---- dashboard ----
  dashboard() {
    return this.request<DashboardOverview>("GET", "/dashboard/")
  }

  securityScore() {
    return this.request<SecurityScore>("GET", "/dashboard/security-score/")
  }

  recomputeScore() {
    return this.request<SecurityScore>("POST", "/dashboard/security-score/")
  }

  getSecurityScoreHistory(range: ScoreHistoryRange = "30d") {
    return this.request<ScoreHistoryResponse>(
      "GET",
      `/dashboard/security-score/history/?range=${range}`,
    )
  }

  // ---- accounts ----
  listAccounts() {
    return this.request<Account[]>("GET", "/accounts/")
  }

  createAccount(input: AccountInput) {
    return this.request<Account>("POST", "/accounts/", input)
  }

  updateAccount(id: number, input: Partial<AccountInput>) {
    return this.request<Account>("PATCH", `/accounts/${id}/`, input)
  }

  deleteAccount(id: number) {
    return this.request<null>("DELETE", `/accounts/${id}/`)
  }

  // ---- devices ----
  listDevices() {
    return this.request<Device[]>("GET", "/devices/")
  }

  createDevice(input: DeviceInput) {
    return this.request<Device>("POST", "/devices/", input)
  }

  updateDevice(id: number, input: Partial<DeviceInput>) {
    return this.request<Device>("PATCH", `/devices/${id}/`, input)
  }

  deleteDevice(id: number) {
    return this.request<null>("DELETE", `/devices/${id}/`)
  }

  // ---- incidents ----
  listIncidents() {
    return this.request<Incident[]>("GET", "/incidents/")
  }

  createIncident(input: IncidentInput) {
    return this.request<Incident>("POST", "/incidents/", input)
  }

  updateIncident(id: number, input: Partial<IncidentInput>) {
    return this.request<Incident>("PATCH", `/incidents/${id}/`, input)
  }

  deleteIncident(id: number) {
    return this.request<null>("DELETE", `/incidents/${id}/`)
  }

  // ---- scanner ----
  scanUrl(input: string, context?: Record<string, unknown>) {
    return this.request<ScanResponse>("POST", "/scan/url", { input, context })
  }

  scanMessage(input: string, context?: Record<string, unknown>) {
    return this.request<ScanResponse>("POST", "/scan/message", { input, context })
  }

  scanHistory() {
    return this.request<ScanResultRecord[]>("GET", "/scan/history")
  }

  // ---- ai assistant ----
  aiExplainScan(scanId: string, locale: "ar" | "en" = "ar") {
    return this.request<AIResponse>("POST", "/ai/explain-scan", { scan_id: scanId, locale })
  }

  aiGuidance(topic: AITopic) {
    return this.request<AIResponse>("POST", "/ai/guidance", { topic })
  }

  // ---- AI Chat (v1.3.0) ----
  listConversations() {
    return this.request<AIConversation[]> ("GET", "/ai/conversations/")
  }

  createConversation(title?: string) {
    return this.request<AIConversation>("POST", "/ai/conversations/", { title: title ?? "" })
  }

  getConversation(id: number) {
    return this.request<AIConversationDetail>("GET", `/ai/conversations/${id}/`)
  }

  sendChatMessage(id: number, content: string) {
    return this.request<{ user: AIMessage; assistant: AIMessage }>(
      "POST", `/ai/conversations/${id}/messages/`, { content }
    )
  }

  deleteConversation(id: number) {
    return this.request<void>("DELETE", `/ai/conversations/${id}/`)
  }

  // ---- P21.3: Staff AI Settings ----
  getAISettings() {
    return this.request<AISettings>("GET", "/staff/ai-settings/")
  }

  updateAISettings(input: {
    provider: AISettings["provider"];
    model: string;
    is_enabled: boolean;
    cloud_consent: boolean;
  }) {
    return this.request<AISettings>("PATCH", "/staff/ai-settings/", {
      body: JSON.stringify(input),
    })
  }

  testAIProvider(input: {
    provider: AISettings["provider"];
    model: string;
  }) {
    return this.request<AITestResult>("POST", "/staff/ai-settings/test/", {
      body: JSON.stringify(input),
    })
  }

  disableAI() {
    return this.request<AISettings>("POST", "/staff/ai-settings/disable/")
  }

  // ---- breach monitor ----
  listMonitoredEmails() {
    return this.request<MonitoredEmail[]>("GET", "/breach/monitored-emails/")
  }

  addMonitoredEmail(input: BreachConsentPayload) {
    return this.request<MonitoredEmail>("POST", "/breach/monitored-emails/", input)
  }

  removeMonitoredEmail(id: number) {
    return this.request<null>("DELETE", `/breach/monitored-emails/${id}/`)
  }

  checkBreaches() {
    return this.request<CheckSummary>("POST", "/breach/check/")
  }

  listHits() {
    return this.request<BreachHit[]>("GET", "/breach/hits/")
  }

  // ---- two-factor manager (P8) ----
  getTwoFactorProfile() {
    return this.request<TwoFactorProfile>("GET", "/two-factor/profile/")
  }

  createTwoFactorProfile(input: { kdf_salt: string }) {
    return this.request<TwoFactorProfile>("POST", "/two-factor/profile/", input)
  }

  updateTwoFactorProfile(input: { kdf_salt: string }) {
    return this.request<TwoFactorProfile>("PATCH", "/two-factor/profile/", input)
  }

  deleteTwoFactorProfile() {
    return this.request<null>("DELETE", "/two-factor/profile/")
  }

  listTwoFactorEntries() {
    return this.request<TwoFactorEntry[]>("GET", "/two-factor/entries/")
  }

  createTwoFactorEntry(input: TwoFactorCreateEntryInput) {
    return this.request<TwoFactorEntry>("POST", "/two-factor/entries/", input)
  }

  updateTwoFactorEntry(id: number, input: TwoFactorUpdateEntryInput) {
    return this.request<TwoFactorEntry>("PATCH", `/two-factor/entries/${id}/`, input)
  }

  deleteTwoFactorEntry(id: number) {
    return this.request<null>("DELETE", `/two-factor/entries/${id}/`)
  }

  createRecoveryCodes(codes: { code_hash: string; salt: string; ciphertext: string; iv: string }[]) {
    return this.request<{ created: number }>("POST", "/two-factor/recovery-codes/", { codes })
  }

  getRecoveryCodeCount() {
    return this.request<{ total: number; used: number; remaining: number }>("GET", "/two-factor/recovery-codes/count/")
  }

  redeemRecoveryCode(codeHash: string) {
    return this.request<{ salt: string; ciphertext: string; iv: string }>("POST", "/two-factor/recovery-codes/redeem/", { code_hash: codeHash })
  }

  completeRecoveryCode(codeHash: string) {
    return this.request<{ status: string }>("POST", "/two-factor/recovery-codes/complete/", { code_hash: codeHash })
  }

  deleteRecoveryCodes() {
    return this.request<null>("DELETE", "/two-factor/recovery-codes/")
  }

  // ---- password manager (P9) ----
  getPasswordVaultProfile() {
    return this.request<PasswordVaultProfile>("GET", "/password-vault/profile/")
  }

  createPasswordVaultProfile(input: PasswordCreateProfileInput) {
    return this.request<PasswordVaultProfile>("POST", "/password-vault/profile/", input)
  }

  /** Wipes the entire vault. The account password confirms the action. */
  deletePasswordVaultProfile(accountPassword: string) {
    return this.request<null>("DELETE", "/password-vault/profile/", {
      account_password: accountPassword,
    })
  }

  listPasswordEntries() {
    return this.request<PasswordEntry[]>("GET", "/password-vault/entries/")
  }

  createPasswordEntry(input: PasswordCreateEntryInput) {
    return this.request<PasswordEntry>("POST", "/password-vault/entries/", input)
  }

  updatePasswordEntry(id: number, input: PasswordUpdateEntryInput) {
    return this.request<PasswordEntry>("PATCH", `/password-vault/entries/${id}/`, input)
  }

  deletePasswordEntry(id: number) {
    return this.request<null>("DELETE", `/password-vault/entries/${id}/`)
  }

  // ---- family protection (P10) ----
  getFamily() {
    return this.request<Family>("GET", "/family/")
  }

  createFamily(name: string) {
    return this.request<Family>("POST", "/family/", { name })
  }

  renameFamily(name: string) {
    return this.request<Family>("PATCH", "/family/", { name })
  }

  deleteFamily(accountPassword: string) {
    return this.request<null>("DELETE", "/family/", { account_password: accountPassword })
  }

  listMembers() {
    return this.request<FamilyMemberSummary[]>("GET", "/family/members/")
  }

  getMember(userId: number) {
    return this.request<FamilyMemberSummary>("GET", `/family/members/${userId}/`)
  }

  removeMember(userId: number) {
    return this.request<null>("DELETE", `/family/members/${userId}/`)
  }

  getMe() {
    return this.request<FamilyMe>("GET", "/family/me/")
  }

  updateMe(toggles: FamilyShareToggles) {
    return this.request<FamilyMe>("PATCH", "/family/me/", toggles)
  }

  listInvitations() {
    return this.request<FamilyInvitation[]>("GET", "/family/invitations/")
  }

  createInvitation(input: FamilyInvitationCreateInput) {
    return this.request<FamilyInvitation>("POST", "/family/invitations/", input)
  }

  cancelInvitation(id: number) {
    return this.request<null>("DELETE", `/family/invitations/${id}/`)
  }

  acceptInvitation(input: FamilyInvitationAcceptInput) {
    return this.request<{ family_id: number; family_name: string; role: string }>(
      "POST",
      "/family/invitations/accept/",
      input,
    )
  }

  transferGuardianship(input: FamilyTransferInput) {
    return this.request<Family>("POST", "/family/transfer/", input)
  }

  listAlerts() {
    return this.request<FamilyAlert[]>("GET", "/family/alerts/")
  }
  // ---- phishing awareness (P11) ----
  getAwarenessCategories() {
    return this.request<any[]>("GET", "/awareness/categories/")
  }

  getAwarenessScenarios(params: {
    category?: string
    difficulty?: number
    limit?: number
    exclude_answered?: boolean
    locale?: string
  } = {}) {
    const q = new URLSearchParams()
    if (params.category) q.set("category", params.category)
    if (params.difficulty !== undefined) q.set("difficulty", String(params.difficulty))
    if (params.limit !== undefined) q.set("limit", String(params.limit))
    if (params.exclude_answered) q.set("exclude_answered", "true")
    if (params.locale) q.set("locale", params.locale)
    const qs = q.toString()
    const url = qs ? `/awareness/scenarios/?${qs}` : "/awareness/scenarios/"
    return this.request<any[]>("GET", url)
  }

  getAwarenessScenario(id: string) {
    return this.request<any>("GET", `/awareness/scenarios/${id}/`)
  }

  answerAwareness(body: {
    scenario_id: string
    answer: "safe" | "phishing" | "unsure"
  }) {
    return this.request<any>("POST", "/awareness/answer/", body)
  }

  getAwarenessProgress() {
    return this.request<any>("GET", "/awareness/progress/")
  }

  resetAwareness() {
    return this.request<null>("POST", "/awareness/reset/", {})
  }

  // ---- subscription tiers (P12) ----
  getPlans() {
    return this.request<Plan[]>("GET", "/billing/plans/")
  }

  getOrgUsage(orgId: string) {
    return this.request<OrgUsage>("GET", `/billing/org-usage/?org_id=${encodeURIComponent(orgId)}`)
  }

  getSubscription() {
    return this.request<Subscription>("GET", "/billing/subscription/")
  }

  changePlan(body: { plan_id: PlanId; period?: BillingPeriod }) {
    return this.request<PlanChangeResponse>("POST", "/billing/subscription/change/", body)
  }

  cancelSubscription() {
    return this.request<Subscription>("POST", "/billing/subscription/cancel/", {})
  }

  resumeSubscription() {
    return this.request<Subscription>("POST", "/billing/subscription/resume/", {})
  }

  getBillingUsage() {
    return this.request<BillingUsage>("GET", "/billing/usage/")
  }

  // ---- staff dashboard (P13.2) ----
  private _qs(params: Record<string, string | number | undefined>): string {
    const q = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") q.set(key, String(value))
    }
    const s = q.toString()
    return s ? `?${s}` : ""
  }

  listStaffUsers(params: {
    q?: string
    status?: string
    page?: number
  } = {}) {
    return this.request<Paginated<StaffUser>>("GET", `/staff/users/${this._qs(params)}`)
  }

  getStaffUser(id: number) {
    return this.request<StaffUserSnapshot>("GET", `/staff/users/${id}/`)
  }

  // Threat Intelligence (P21.1)
  getThreatIntelStatus() {
    return this.request<any>("GET", `/threat-intel/status/`)
  }

  refreshThreatIntel() {
    return this.request<any>("POST", `/threat-intel/refresh/`)
  }

  checkThreatIntelDomain(domain: string) {
    return this.request<any>("GET", `/threat-intel/check/?domain=${encodeURIComponent(domain)}`)
  }

  // ── Accounts (v1.2.0) ──
  listAccountsUsers(params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString()
    return this.request<{ count: number; results: any[] }>("GET", `/accounts/users/${qs ? "?" + qs : ""}`)
  }
  getAccountsUser(id: number) {
    return this.request<any>("GET", `/accounts/users/${id}/`)
  }
  createAccountsUser(body: any) {
    return this.request<any>("POST", "/accounts/users/", body)
  }
  updateAccountsUser(id: number, body: any) {
    return this.request<any>("PATCH", `/accounts/users/${id}/`, body)
  }
  deactivateAccountsUser(id: number) {
    return this.request<any>("DELETE", `/accounts/users/${id}/`)
  }
  resetAccountsUserPassword(id: number, password: string) {
    return this.request<any>("POST", `/accounts/users/${id}/reset-password/`, { password })
  }
  listAccountsInvitations() {
    return this.request<{ count: number; results: any[] }>("GET", "/accounts/invitations/")
  }
  createAccountsInvitation(body: { email: string; organization_id: string; role: string }) {
    return this.request<any>("POST", "/accounts/invitations/", body)
  }
  resendAccountsInvitation(id: number) {
    return this.request<any>("POST", `/accounts/invitations/${id}/resend/`)
  }
  revokeAccountsInvitation(id: number) {
    return this.request<any>("DELETE", `/accounts/invitations/${id}/`)
  }

  blockStaffUser(id: number, reason: string) {
    return this.request<StaffModeration>("POST", `/staff/users/${id}/block/`, { reason })
  }

  unblockStaffUser(id: number, reason: string) {
    return this.request<StaffModeration>("POST", `/staff/users/${id}/unblock/`, { reason })
  }

  listAuditLog(params: {
    actor?: string
    target?: string
    action?: string
    since?: string
    until?: string
    page?: number
  } = {}) {
    return this.request<Paginated<AdminActionLogEntry>>("GET", `/staff/audit/${this._qs(params)}`)
  }

  listTickets(params: {
    status?: string
    priority?: string
    assigned_to?: string
    page?: number
  } = {}) {
    return this.request<Paginated<SupportTicket>>("GET", `/staff/tickets/${this._qs(params)}`)
  }

  createTicket(input: { subject: string; body: string; target_user_id?: number }) {
    return this.request<SupportTicketDetail>("POST", `/staff/tickets/`, input)
  }

  getTicket(id: number) {
    return this.request<SupportTicketDetail>("GET", `/staff/tickets/${id}/`)
  }

  updateTicket(
    id: number,
    patch: { status?: string; priority?: string; assigned_to?: number | null },
  ) {
    return this.request<SupportTicket>("PATCH", `/staff/tickets/${id}/`, patch)
  }

  addTicketMessage(id: number, body: string) {
    return this.request<SupportTicketMessage>("POST", `/staff/tickets/${id}/messages/`, { body })
  }

  // ---- advanced admin (P13.3) ----

  impersonateUser(id: number, reason: string) {
    return this.request<ImpersonationStartResponse>(
      "POST",
      `/staff/users/${id}/impersonate/`,
      { reason },
    )
  }

  endImpersonation(sessionId?: number) {
    return this.request<{ ended: boolean }>("POST", "/staff/impersonate/end/", {
      session_id: sessionId,
    })
  }

  listStaffSubscriptions(params: {
    q?: string
    plan?: string
    status?: string
    period?: string
    page?: number
  } = {}) {
    return this.request<Paginated<StaffSubscriptionRow>>(
      "GET",
      `/staff/subscriptions/${this._qs(params)}`,
    )
  }

  changeStaffSubscription(
    userId: number,
    input: { plan_id: string; period?: string; reason?: string },
  ) {
    return this.request<StaffSubscriptionRow>(
      "POST",
      `/staff/subscriptions/${userId}/change/`,
      input,
    )
  }

  listAnnouncements(params: { page?: number } = {}) {
    return this.request<Paginated<StaffAnnouncement>>(
      "GET",
      `/staff/announcements/${this._qs(params)}`,
    )
  }

  createAnnouncement(input: {
    subject: string
    body: string
    audience: AnnouncementAudience
  }) {
    return this.request<StaffAnnouncement>("POST", "/staff/announcements/", input)
  }

  previewAnnouncement(id: number) {
    return this.request<{ recipient_count: number; audience: Record<string, unknown> }>(
      "POST",
      `/staff/announcements/${id}/preview/`,
      {},
    )
  }

  sendAnnouncement(id: number) {
    return this.request<StaffAnnouncement>("POST", `/staff/announcements/${id}/send/`, {})
  }

  requestUserExport(id: number, reason: string) {
    return this.request<ExportRequestResponse>("POST", `/staff/users/${id}/export/`, { reason })
  }

  downloadUserExport(token: string) {
    return this.request<Record<string, unknown>>("GET", `/staff/exports/${token}/`)
  }

  listStaffMetrics(params: { range: "7d" | "30d" | "90d" }) {
    return this.request<{
      signups_per_day: Array<{ date: string; count: number }>
      scans_per_day: Array<{ date: string; count: number }>
      subscriptions_by_plan: Record<string, number>
      tickets_opened_per_day: Array<{ date: string; count: number }>
      tickets_closed_per_day: Array<{ date: string; count: number }>
    }>("GET", `/staff/metrics/${this._qs(params)}`)
  }

  // ---- organizations (P18.1c2) ----

  listOrganizations() {
    return this.request<Organization[]>("GET", "/organizations/")
  }

  getOrganizationOverview(id: string) {
    return this.request<OrganizationOverview>("GET", `/organizations/${id}/overview/`)
  }

  listOrganizationMembers(id: string) {
    return this.request<OrgMemberRow[]>("GET", `/organizations/${id}/members/`)
  }

  listNotifications() {
    return this.request<NotificationList>("GET", "/notifications/")
  }

  markNotificationRead(id: number) {
    return this.request<NotificationItem>("POST", `/notifications/${id}/read/`, {})
  }

  markAllNotificationsRead() {
    return this.request<{ marked_read: number }>(
      "POST",
      "/notifications/mark-all-read/",
      {},
    )
  }

  listOrganizationActivity(id: string, limit = 10) {
    return this.request<OrgActivityRow[]>(
      "GET",
      `/organizations/${id}/activity/?limit=${limit}`,
    )
  }

  listOrgAudit(
    orgId: string,
    params?: { action?: string; actor?: string; limit?: number; offset?: number },
  ) {
    const q = new URLSearchParams()
    if (params?.action) q.set("action", params.action)
    if (params?.actor) q.set("actor", params.actor)
    if (params?.limit != null) q.set("limit", String(params.limit))
    if (params?.offset != null) q.set("offset", String(params.offset))
    const qs = q.toString() ? `?${q.toString()}` : ""
    return this.request<OrgAuditResponse>(
      "GET",
      `/organizations/${orgId}/audit/${qs}`,
    )
  }

  // ---- generic verbs (P18.3) ---------------------------------------------
  // Thin wrappers over `request` for endpoints that are addressed by path
  // rather than by a fixed, named helper.

  get<T = unknown>(path: string) {
    return this.request<T>("GET", path)
  }

  post<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body)
  }

  patch<T = unknown>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body)
  }

  delete<T = unknown>(path: string) {
    return this.request<T>("DELETE", path)
  }

  // ---- invitations (P18.3) ------------------------------------------------

  listMyInvitations() {
    return this.request<MyInvitation[]>("GET", "/me/invitations/")
  }

  acceptInvitationById(id: number | string) {
    return this.request<{ organization: unknown; role: string }>(
      "POST",
      `/me/invitations/${id}/accept/`,
    )
  }

  declineInvitationById(id: number | string) {
    return this.request<{ status: string }>(
      "POST",
      `/me/invitations/${id}/decline/`,
    )
  }
}
