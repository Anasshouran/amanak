import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ThemeProvider } from "../../../design/ThemeProvider"
import { ScanInput } from "../ScanInput"

function renderInput(overrides: Partial<Parameters<typeof ScanInput>[0]> = {}) {
  const props = {
    kind: "url" as const,
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  }
  render(
    <ThemeProvider>
      <ScanInput {...props} />
    </ThemeProvider>,
  )
  return props
}

describe("ScanInput", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
  })

  it("labels the URL field and exposes a scan button", () => {
    renderInput()
    expect(screen.getByLabelText("Enter a URL to scan")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Scan" })).toBeInTheDocument()
  })

  it("labels the message field in message mode", () => {
    renderInput({ kind: "message" })
    expect(screen.getByLabelText("Paste a message")).toBeInTheDocument()
  })

  it("shows a validation message when submitting empty input", async () => {
    const { onSubmit } = renderInput()
    await userEvent.click(screen.getByRole("button", { name: "Scan" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Enter a link or message to scan.")
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("submits the typed value", async () => {
    const { onSubmit } = renderInput({ value: "https://example.com" })
    await userEvent.click(screen.getByRole("button", { name: "Scan" }))
    expect(onSubmit).toHaveBeenCalledWith("https://example.com")
  })

  it("disables the button and reports busy while scanning", () => {
    renderInput({ value: "https://example.com", busy: true })
    const button = screen.getByRole("button")
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute("aria-busy", "true")
    expect(button).toHaveTextContent("Scanning")
  })
})
