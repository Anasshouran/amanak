/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { act } from "react-dom/test-utils"
import { renderWithProviders } from "../../../test/render"
import { ThemePicker } from "../ThemePicker"

function findButtonByText(container: HTMLElement, text: string) {
  return Array.from(container.querySelectorAll('div[tabindex="0"]')).find((b) => b.textContent === text)
}

beforeEach(() => {
  window.localStorage.setItem("amanak.locale", "en")
  window.localStorage.removeItem("amanak.theme")
  document.documentElement.removeAttribute("data-theme")
})

afterEach(() => {
  window.localStorage.removeItem("amanak.theme")
  document.documentElement.removeAttribute("data-theme")
})

describe("ThemePicker", () => {
  it("switches the theme between Light and Dark", () => {
    const { container } = renderWithProviders(<ThemePicker />)

    act(() => {
      ;(findButtonByText(container, "Dark") as HTMLElement)?.click()
    })
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")

    act(() => {
      ;(findButtonByText(container, "Light") as HTMLElement)?.click()
    })
    expect(document.documentElement.getAttribute("data-theme")).toBe("light")
  })

  it("persists the choice across remounts", () => {
    const { container, unmount } = renderWithProviders(<ThemePicker />)

    act(() => {
      ;(findButtonByText(container, "Dark") as HTMLElement)?.click()
    })
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    expect(window.localStorage.getItem("amanak.theme")).toBe("dark")

    unmount()

    const { container: container2 } = renderWithProviders(<ThemePicker />)
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark")
    container2.remove()
  })
})
