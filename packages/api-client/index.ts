/**
 * Typed API client for AMANAK.
 *
 * Error shape: { code, message, details } is preserved from the backend so
 * callers can branch on stable error codes.
 */

import type {
  Account,
  AccountInput,
  ApiError,
  AuthResponse,
  AuthTokens,
  DashboardOverview,
  Device,
  DeviceInput,
  Incident,
  IncidentInput,
  ScanResponse,
  ScanResultRecord,
  SecurityScore,
  User,
} from "@amanak/shared-types"

export type { ApiError }

export type TokenStore = {
  getAccessToken: () => Promise<string | null>
  getRefreshToken: () => Promise<string | null>
  setTokens: (tokens: AuthTokens) => Promise<void>
  clear: () => Promise<void>
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly tokens: TokenStore

  constructor(baseUrl: string, tokens: TokenStore) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
    this.tokens = tokens
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
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
    })

    let data: unknown = null
    try {
      data = await res.json()
    } catch {
      // non-JSON body
    }

    if (!res.ok) {
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

  async refresh() {
    const refresh = await this.tokens.getRefreshToken()
    if (!refresh) throw { code: "NO_REFRESH_TOKEN", message: "No refresh token" }
    const res = await this.request<{ access: string }>("POST", "/auth/refresh-token/", {
      refresh,
    })
    return res.access
  }

  async logout() {
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
}