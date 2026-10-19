/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import { renderWithProviders } from "../../../test/render"
import { SettingsPrivacy } from "../SettingsPrivacy"

const apiMock = vi.hoisted(() => ({
  requestMyExport: vi.fn(),
}))

vi.mock("../../../lib/api", () => ({ api: apiMock }))

function downloadButton(container: HTMLElement) {
  return container.querySelector('button, div[role="button"], div[tabindex="0"]') as HTMLElement | null
}

beforeEach(() => {
  window.localStorage.setItem("amanak.locale", "en")
})

describe("SettingsPrivacy", () => {
  it("requests an export and reports it is ready", async () => {
    apiMock.requestMyExport.mockResolvedValue({
      token: "abc",
      download_url: "/api/v1/me/export/abc/",
      expires_at: "2026-10-19T12:00:00Z",
    })
    const rendered = renderWithProviders(<SettingsPrivacy />)

    expect(rendered.text()).toContain("Download my data")

    await act(async () => {
      downloadButton(rendered.container)?.click()
    })

    expect(apiMock.requestMyExport).toHaveBeenCalledTimes(1)
    expect(rendered.text()).toContain("Your export is ready to download.")
    rendered.unmount()
  })

  it("shows an error when the request fails", async () => {
    apiMock.requestMyExport.mockRejectedValue(new Error("boom"))
    const rendered = renderWithProviders(<SettingsPrivacy />)

    await act(async () => {
      downloadButton(rendered.container)?.click()
    })

    expect(rendered.text()).toContain("Could not start the export. Try again.")
    rendered.unmount()
  })
})
