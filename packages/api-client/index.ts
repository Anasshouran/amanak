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
  AITopic,
  ApiError,
  AuthResponse,
  AuthTokens,
  BreachConsentPayload,
  BreachHit,
  CheckSummary,
  DashboardOverview,
  Device,
  DeviceInput,
  Incident,
  IncidentInput,
  MonitoredEmail,
  PasswordCreateEntryInput,
  PasswordCreateProfileInput,
  PasswordEntry,
  PasswordUpdateEntryInput,
  PasswordVaultProfile,
  ScanResponse,
  ScanResultRecord,
  SecurityScore,
  TwoFactorCreateEntryInput,
  TwoFactorEntry,
  TwoFactorProfile,
  TwoFactorUpdateEntryInput,
  User,
} from "@amanak/shared-types"

export type { ApiError }

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
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly tokens: TokenStore
  private readonly options: ApiClientOptions
  private refreshing: Promise<string | null> | null = null

  constructor(baseUrl: string, tokens: TokenStore, options: ApiClientOptions = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.tokens = tokens
    this.options = options
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
    }
    if (access) {
      headers.Authorization = `Bearer ${access}`
    }

    const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: this.options.credentials,
    })

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
      throw {
        code: error.code ?? String(res.status),
        message:
          error.message ??
          error.detail ??
          (typeof data === "object" && data && "detail" in error
            ? String(error.detail)
            : "Request failed"),
        details: error.details,
      } as ApiError
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
}