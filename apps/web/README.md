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
| `npm run e2e` | Run the Playwright end-to-end suite (see below). |
| `npm run e2e:ui` | Run Playwright in interactive UI mode. |
| `npm run e2e:screenshots` | Capture 40 screenshots (10 screens × 2 themes × 2 locales). |

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

## 2FA vault (P8)

The `/vault` route (`src/pages/TwoFactor.tsx`) is a server-blind TOTP manager.
Secrets are encrypted in the browser with `AES-256-GCM` under a key derived
from a master password via `PBKDF2-HMAC-SHA256` (310,000 iterations); the
server only stores ciphertext. The crypto lives in `src/crypto/`
(`base32`, `totp`, `kdf`, `aes`, `unlock`, `bytes`) and is covered by Vitest
against RFC 4648, RFC 6238 and GCM vectors. A vault opens on both web and
mobile because the blob format is identical (see
`docs/security/2fa-privacy.md` and ADR-0006).

QR import uses an uploaded image decoded with `jsqr`; manual base32 entry is
always available. The vault auto-locks after 5 minutes of inactivity.

## Password manager (P9)

The `/passwords` route (`src/pages/PasswordVault.tsx`) is a server-blind password
vault that reuses the same P8 primitives. The password, notes and custom-field
values are encrypted in the browser as an opaque `AES-256-GCM` blob; the plain
`title`/`username`/`url`/`category`/`tags` metadata is stored server-side so
search and filtering work. The crypto helpers live in `src/crypto/`
(`passwordPayload`, `strength`, `generator`) and are covered by Vitest.

Features: a setup/unlock wizard with a 5-fail/5-min → 15-min lockout, reveal
(hidden again after 10 s) and copy, categories and tag search, a password
generator, and encrypted JSON import/export. Deleting the whole vault requires
the **account** password, never the vault master password. The vault auto-locks
after 5 minutes of inactivity. See `docs/security/password-vault-privacy.md` and
ADR-0009.

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

## End-to-end tests

Playwright specs live in `e2e/` and run against the Vite dev server, which
Playwright starts automatically (`reuseExistingServer` reuses one already up).
The backend must be reachable via `VITE_API_URL` (default
`http://localhost:8080` — the local Compose stack). Run that backend with
`DJANGO_DEBUG=true` and a raised `AUTH_THROTTLE_RATE` (e.g. `1000/min`): the
suite's session refreshes otherwise trip the production `auth` throttle of
20/min. The rate override is ignored unless debug is on.

```bash
npx playwright install --with-deps chromium   # once
npm run e2e                                    # headless
npm run e2e:ui                                 # interactive
```

Specs: `auth`, `scanner`, `breach`, `theme-locale`, `password-vault`, and
`screenshot`.

### Screenshots

`screenshot.spec.ts` captures every screen in both themes and both locales
(40 PNGs) into `apps/web/screenshots/`. It is skipped unless explicitly enabled,
so it never runs in CI by default:

```bash
npm run e2e:screenshots
```
