import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { ToastProvider } from "../../../design/components"
import { TwoFactorList } from "../TwoFactorList"
import type { TwoFactorProfile, TwoFactorEntry } from "@amanak/shared-types"

vi.mock("../../../lib/api", () => ({
  api: {
    listTwoFactorEntries: vi.fn(async () => [] as TwoFactorEntry[]),
    updateTwoFactorEntry: vi.fn(async () => undefined),
    deleteTwoFactorEntry: vi.fn(async () => undefined),
    deleteTwoFactorProfile: vi.fn(async () => undefined),
  },
}))

import { api } from "../../../lib/api"

function profile(): TwoFactorProfile {
  return {
    id: 1,
    kdf_salt: "salt",
    kdf_iterations: 100000,
    kdf_algorithm: "pbkdf2_sha256",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function entry(overrides: Partial<TwoFactorEntry> = {}): TwoFactorEntry {
  return {
    id: 1,
    label: "label-1",
    issuer: "Google",
    ciphertext: "dGVzdC1jaXBoZXJ0ZXh0",
    iv: "dGVzdC1pdi1kYXRh",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

describe("TwoFactorList", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    vi.mocked(api.listTwoFactorEntries).mockResolvedValue([])
  })

  it("shows empty state when no entries", async () => {
    render(
      <ThemeProvider>
        <ToastProvider>
          <TwoFactorList profile={profile()} onAutoLocked={vi.fn()} onVaultDeleted={vi.fn()} />
        </ToastProvider>
      </ThemeProvider>,
    )
    expect(await screen.findByText("No authenticator apps yet")).toBeInTheDocument()
  })

  it("renders rows for each entry", async () => {
    vi.mocked(api.listTwoFactorEntries).mockResolvedValue([entry()])
    render(
      <ThemeProvider>
        <ToastProvider>
          <TwoFactorList profile={profile()} onAutoLocked={vi.fn()} onVaultDeleted={vi.fn()} />
        </ToastProvider>
      </ThemeProvider>,
    )
    expect(await screen.findByText("Google")).toBeInTheDocument()
    expect(screen.getByText("label-1")).toBeInTheDocument()
  })
})
