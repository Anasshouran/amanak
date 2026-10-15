import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { LineChart } from "../LineChart"

const DATA = [
  { label: "01-01", value: 40 },
  { label: "01-02", value: 55 },
  { label: "01-03", value: 70 },
]

afterEach(() => {
  document.documentElement.setAttribute("dir", "ltr")
  cleanup()
})

describe("LineChart", () => {
  it("renders nothing when there are no points", () => {
    const { container } = render(<LineChart data={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("renders a single point without a line", () => {
    const { container } = render(<LineChart data={[{ label: "01-01", value: 50 }]} />)
    expect(container.querySelector("svg")).not.toBeNull()
    expect(container.querySelectorAll("circle").length).toBe(1)
    expect(container.querySelectorAll("table tbody tr").length).toBe(1)
  })

  it("exposes a viewBox and an accessible label", () => {
    const { container } = render(<LineChart data={DATA} ariaLabel="trend summary" />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    expect(svg?.getAttribute("viewBox")).toBe("0 0 600 180")
    expect(screen.getByRole("img")).toHaveAttribute("aria-label", "trend summary")
  })

  it("provides a visually hidden table of the raw data", () => {
    const { container } = render(<LineChart data={DATA} />)
    const table = container.querySelector("table.sr-only")
    expect(table).not.toBeNull()
    expect(table?.querySelectorAll("tbody tr").length).toBe(3)
    expect(table?.textContent).toContain("01-02")
    expect(table?.textContent).toContain("55")
  })

  it("shows a guide line and tooltip on hover", () => {
    const { container } = render(<LineChart data={DATA} />)
    const svg = container.querySelector("svg")
    expect(svg).not.toBeNull()
    vi.spyOn(svg as SVGSVGElement, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      right: 600,
      bottom: 180,
      width: 600,
      height: 180,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect)

    fireEvent.mouseMove(svg as SVGSVGElement, { clientX: 300, clientY: 50 })

    expect(container.querySelector('svg rect[width="104"]')).not.toBeNull()
    expect((svg as SVGSVGElement).textContent).toContain("55")
  })

  it("mirrors the x-axis when the container is rtl", () => {
    document.documentElement.setAttribute("dir", "rtl")
    const { container } = render(<LineChart data={DATA} />)
    const texts = Array.from(container.querySelectorAll("text"))
    const xOf = (label: string) =>
      Number(texts.find((el) => el.textContent === label)?.getAttribute("x"))
    expect(xOf("01-01")).toBeGreaterThan(xOf("01-03"))
  })

  it("keeps the x-axis left-to-right in ltr", () => {
    const { container } = render(<LineChart data={DATA} />)
    const texts = Array.from(container.querySelectorAll("text"))
    const xOf = (label: string) =>
      Number(texts.find((el) => el.textContent === label)?.getAttribute("x"))
    expect(xOf("01-01")).toBeLessThan(xOf("01-03"))
  })
})
