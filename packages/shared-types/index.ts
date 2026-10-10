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