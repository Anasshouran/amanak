# Technical Debt

Tracked, non-blocking gaps that are deliberately deferred. Each entry records
the current state, impact, and the planned fix.

## Open

_No open items._

## Resolved

- **Direct navigation to `/register` bounced to `/login`.** `apps/web/src/lib/api.ts`
  redirected unauthenticated users to `/login` on any 401 regardless of the
  target route, so direct navigation to `/register` (bookmark, shared link, deep
  link) landed on `/login`. Fixed in **P7.4**: `onUnauthorized` now skips the
  redirect for public routes (`PUBLIC_ROUTES = {"/login", "/register"}`). The
  E2E `registerUser` fixture deep-links to `/register` again, with a regression
  test in `apps/web/e2e/auth.spec.ts`.

- **ReDoS timing test flaked under heavy parallel load.** `tests/security/test_redos.py`
  occasionally failed when the full suite ran alongside other heavy workloads;
  it passed reliably in isolation and on CI runners. Fixed in **P7.4**: the
  per-rule budget was raised from 50 ms to 80 ms, trading a little tightness for
  stability while still catching catastrophic backtracking.

- **Mobile API URL was hardcoded (P7.3).** `apps/mobile/src/lib/api.ts`
  hardcoded `127.0.0.1:8000` (or `10.0.2.2:8000` on the Android emulator) and
  ignored `EXPO_PUBLIC_API_URL`, which broke physical-device development, Expo
  web, and production. Fixed in **P7.4**: the base URL is now resolved by
  `apps/mobile/src/lib/apiUrl.ts` — `EXPO_PUBLIC_API_URL` first, then a
  per-platform default, failing fast on a physical device without the env var —
  with unit tests in `apps/mobile/src/lib/__tests__/apiUrl.test.ts`.
