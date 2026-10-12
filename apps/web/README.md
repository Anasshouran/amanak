# @amanak/web

The AMANAK web client: a Vite + React + TypeScript single-page app.

This package was reworked in **P7.3** around a small, dependency-light design
system with full **Arabic/English** and **RTL/LTR** support and **dark/light**
themes.

## Getting started

```bash
npm install
npm run dev          # http://127.0.0.1:5173 (proxies /api to the backend)
```

The dev server proxies `/api` to `http://127.0.0.1:8000`, so run the backend
(the Docker Compose stack) alongside it.

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run build` | Type-check (`tsc --noEmit`) then build to `dist/`. |
| `npm run preview` | Preview the production build. |
| `npm run typecheck` | Type-check only. |
| `npm test` | Run the design-system tests once (Vitest + jsdom). |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run screenshots` | Manually capture theme/locale screenshots (see below). |

## Design system

All design primitives live in `src/design/` and are framework-native: plain CSS
with design tokens, no UI kit, no Tailwind.

```
src/design/
  tokens.ts            Theme + Locale types and token metadata
  ThemeProvider.tsx    Theme (dark/light) + locale (ar/en) context and persistence
  global.css           CSS custom properties, reset, layout, focus styles
  components.css       Component styles built on the tokens
  icons.tsx            Inline SVG icon set
  utils.ts             cx() class-name helper, trapFocus() for dialogs
  i18n/                ar.ts, en.ts, index.tsx (translate() + useT())
  components/          Button, Input, Textarea, Card, Badge, Toast + ToastProvider,
                       Modal, Skeleton, EmptyState, ErrorState, Header, Nav, Tabs,
                       ProgressRing (+ barrel index.ts)
```

### Theming

Colours are defined once as CSS custom properties in `global.css` under
`:root`, `[data-theme="dark"]` (default) and `[data-theme="light"]`. Toggling a
theme flips a single attribute on `<html>`; components never hard-code colours.

`ThemeProvider` reads and writes the preferences in `localStorage`
(`amanak.theme`, `amanak.locale`), applies `data-theme`, `lang` and `dir` on the
document element, and exposes `useTheme()` with `theme`, `locale`, `setTheme`,
`setLocale`, `toggleTheme`, `toggleLocale`.

### Internationalisation and RTL

UI strings are keyed and kept in `src/design/i18n/ar.ts` and `en.ts`.
`useT()` returns a `t(key, vars?)` function; a missing key resolves to the key
itself so gaps are visible during development. Arabic sets `dir="rtl"` and the
Arabic font stack; English switches to LTR. Layouts use logical CSS properties
(`inset-inline`, `border-inline-start`, `text-align: start`) so both directions
share one stylesheet.

### Accessibility

- Every interactive control is a real `<button>`, `<a>` or form element.
- Visible `:focus-visible` rings; a skip-free, single-`<main>` layout.
- `Modal` traps focus, closes on `Escape`/backdrop, and restores focus.
- Live regions (`role="status"` toasts, `aria-live`) announce async results.
- `prefers-reduced-motion` disables transitions and animations.

## Tests

Vitest runs against a jsdom environment with React Testing Library and
`@testing-library/jest-dom` matchers (registered in `src/test/setup.ts`).

```bash
npm test
```

The design-system tests live in `src/design/__tests__/` and cover the theme
provider (defaults, toggling, document attributes, persistence), the
translation helper (lookup, interpolation, missing-key fallback), and the
button primitive (variants, disabled + busy state).

## Screenshots

`scripts/screenshot.mjs` is a manual, Playwright-based helper that captures every
screen in both themes and both locales. It is **not** wired into CI. Install the
browser once, then run:

```bash
npm install -D playwright
npx playwright install chromium
AMANAK_EMAIL=you@example.com AMANAK_PASSWORD=secret npm run screenshots
```

Images are written to `apps/web/screenshots/`.
