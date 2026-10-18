import type { ReactNode } from "react"
import { act } from "react-dom/test-utils"
import { createRoot, type Root } from "react-dom/client"
import { ThemeProvider } from "../design/ThemeProvider"
import { LocaleProvider } from "../design/LocaleProvider"

// React 18 only enables `act()` outside a real test renderer behind this flag.
;(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true

export type Rendered = {
  container: HTMLElement
  /** Everything rendered, whitespace collapsed — handy for text assertions. */
  text: () => string
  unmount: () => void
}

/**
 * Minimal render helper.
 *
 * `@testing-library/react` is only installed for `apps/web`, so mobile component
 * tests drive `react-dom/client` directly (pinned to a single React copy by
 * `vitest.config.ts`).
 */
export function render(node: ReactNode): Rendered {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  act(() => {
    root.render(node)
  })
  return {
    container,
    text: () => (container.textContent ?? "").replace(/\s+/g, " ").trim(),
    unmount: () => {
      act(() => root.unmount())
      container.remove()
    },
  }
}

/** Render inside the theme + locale providers the app itself installs. */
export function renderWithProviders(node: ReactNode): Rendered {
  return render(
    <ThemeProvider>
      <LocaleProvider>{node}</LocaleProvider>
    </ThemeProvider>,
  )
}
