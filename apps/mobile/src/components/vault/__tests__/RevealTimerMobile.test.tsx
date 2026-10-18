/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act } from "react-dom/test-utils"
import { renderWithProviders } from "../../../test/render"
import { RevealTimerMobile } from "../RevealTimerMobile"

describe("RevealTimerMobile", () => {
  beforeEach(() => {
    window.localStorage.setItem("amanak.locale", "en")
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z").getTime())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("counts down from 10 seconds", () => {
    const onExpire = vi.fn()
    const rendered = renderWithProviders(
      <RevealTimerMobile active onExpire={onExpire} />,
    )
    expect(rendered.text()).toContain("10s")
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(rendered.text()).toContain("9s")
    expect(onExpire).not.toHaveBeenCalled()
    rendered.unmount()
  })

  it("fires onExpire when the duration elapses", () => {
    const onExpire = vi.fn()
    const rendered = renderWithProviders(
      <RevealTimerMobile active durationMs={10_000} onExpire={onExpire} />,
    )
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onExpire).toHaveBeenCalledTimes(1)
    rendered.unmount()
  })

  it("clears the interval on unmount", () => {
    const onExpire = vi.fn()
    const rendered = renderWithProviders(
      <RevealTimerMobile active durationMs={10_000} onExpire={onExpire} />,
    )
    rendered.unmount()
    act(() => {
      vi.advanceTimersByTime(10_000)
    })
    expect(onExpire).not.toHaveBeenCalled()
  })
})
