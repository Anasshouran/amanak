/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import { fireEvent } from "@testing-library/dom"
import { renderWithProviders } from "../../../test/render"
import { GeneratorPanel } from "../GeneratorPanel"
import { defaultGeneratorOptions } from "../../../lib/vault/generator"

// `lib/vault/random` pulls in `expo-crypto` (a React Native native module),
// which cannot load in the Node test environment — mock the byte source.
vi.mock("../../../lib/vault/random", () => ({
  randomBytes: (size: number) => {
    const out = new Uint8Array(size)
    for (let i = 0; i < size; i += 1) out[i] = Math.floor(Math.random() * 256)
    return out
  },
}))

const onChange = vi.fn()

beforeEach(() => {
  window.localStorage.setItem("amanak.locale", "en")
  vi.clearAllMocks()
  onChange.mockClear()
})

describe("GeneratorPanel", () => {
  it("generates a password of the requested length", () => {
    const { container } = renderWithProviders(
      <GeneratorPanel
        value=""
        onChange={onChange}
        options={{ ...defaultGeneratorOptions(), length: 16 }}
        onOptionsChange={vi.fn()}
      />,
    )

    const generate = Array.from(container.querySelectorAll("div")).find(
      (b) => b.textContent === "Generate" || b.textContent === "توليد",
    )
    expect(generate).not.toBeNull()
    act(() => {
      fireEvent.click(generate as HTMLElement)
    })

    expect(onChange).toHaveBeenCalledTimes(1)
    const generated = onChange.mock.calls[0][0]
    expect(typeof generated).toBe("string")
    expect(generated.length).toBe(16)
  })

  it("updates the strength meter as the password changes", () => {
    const weak = renderWithProviders(
      <GeneratorPanel
        value=""
        onChange={vi.fn()}
        options={defaultGeneratorOptions()}
        onOptionsChange={vi.fn()}
      />,
    )
    expect(weak.text()).toContain("Weak")
    expect(weak.text()).toContain("0/100")
    weak.unmount()

    const strong = renderWithProviders(
      <GeneratorPanel
        value="Str0ng!@#secure"
        onChange={vi.fn()}
        options={defaultGeneratorOptions()}
        onOptionsChange={vi.fn()}
      />,
    )
    expect(strong.text()).toContain("Strength")
    const score = strong.text().match(/\d+\/100/)
    expect(score).not.toBeNull()
    expect(parseInt(score![0], 10)).toBeGreaterThan(0)
    strong.unmount()
  })
})
