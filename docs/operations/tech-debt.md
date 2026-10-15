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

## P13.2 — staff dashboard deferred items

### StaffMetrics lacks a real aggregation endpoint
StaffHome and StaffMetrics compute from list endpoints; scans-per-day
and subscriptions-by-plan show "unavailable". A future
`GET /staff/metrics/` with DB aggregation + short cache is needed
before launch.

### StaffUsers has bounded N+1 enrichment
The staff list serializer lacks plan/blocked/tickets per row; the UI
enriches each page via snapshots (≤25 requests). Backend should add
these fields to the list serializer to eliminate the N+1.

### "Open ticket on behalf" removed from StaffUserDetail
The backend creates tickets with user=request.user, so the button
mis-scoped tickets to the staff member. P13.3 will add a staff-only
endpoint accepting a target user_id and re-enable the UI.

### 2fa.spec.ts code-rotation timing flake (E2E)
`apps/web/e2e/2fa.spec.ts` occasionally flakes on code rotation when
the test runs near a 30-second TOTP window boundary. Passes reliably
in isolation. Fix: mock the system clock in the test, or wait for a
fresh window before asserting. Not a code defect.

## Concurrent test runs cause transient Postgres contention

Running `pytest` and `npm test` simultaneously against the same
Postgres instance (port 5433) occasionally produces transient
connection errors. Solo runs are clean (backend 404, web 101).

Mitigation: run test suites sequentially in CI (already the case);
document locally. Not a code defect.
