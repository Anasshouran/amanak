/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import { renderWithProviders } from "../../../test/render"
import { SettingsRow } from "../SettingsRow"

beforeEach(() => {
  window.localStorage.setItem("amanak.locale", "en")
})

describe("SettingsRow", () => {
  it("renders the label", () => {
    const rendered = renderWithProviders(<SettingsRow label="Display name" onPress={() => undefined} />)
    expect(rendered.text()).toContain("Display name")
    rendered.unmount()
  })

  it("fires onPress when tapped", () => {
    const onPress = vi.fn()
    const rendered = renderWithProviders(<SettingsRow label="Display name" onPress={onPress} />)
    act(() => {
      ;(rendered.container.querySelector('[role="button"]') as HTMLElement).click()
    })
    expect(onPress).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it("is not pressable when disabled", () => {
    const onPress = vi.fn()
    const rendered = renderWithProviders(<SettingsRow label="Display name" disabled onPress={onPress} />)
    act(() => {
      ;(rendered.container.querySelector('[role="button"]') as HTMLElement).click()
    })
    expect(onPress).not.toHaveBeenCalled()
    rendered.unmount()
  })
})
