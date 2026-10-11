# AMANAK — P5 Production Readiness Report

Date: 2026-10-11
Branch: `master` (working tree at `p4-complete`, uncommitted P5 changes)
Scope: close the six P4 production blockers, harden dependencies, add a runbook
and staging compose, run the acceptance gate.

## Prerequisites

- Tags present: `p1-complete`, `p2-complete`, `p3-complete`, `p4-complete`.
- Containers healthy: `amanak-db` (127.0.0.1:5433), `amanak-redis`
  (127.0.0.1:6380).
- Baseline suite before P5: `POSTGRES_HOST=127.0.0.1 pytest -q` → 183 passed.
- `docker compose config` → exit 0.
- `.env` `AI_ENABLED=false`; no network egress from tests.

## B1 JWT rotation / blacklist

- Added `SIMPLE_JWT`: access 5 min, refresh 7 days, `ROTATE_REFRESH_TOKENS`,
  `BLACKLIST_AFTER_ROTATION`, `UPDATE_LAST_LOGIN`, HS256, `SIGNING_KEY=SECRET_KEY`.
- Added `rest_framework_simplejwt.token_blacklist` to `INSTALLED_APPS`; migrations
  applied to the dev DB (`token_blacklist.0001`–`0012`).
- `POST /api/v1/auth/refresh-token/`: verifies the presented refresh token,
  **blacklists its JTI**, and issues a fresh access+refresh pair. Reuse of a
  rotated token → 401.
- New `POST /api/v1/auth/logout/`: blacklists the presented refresh token
  (body or cookie) and clears the cookie.
- Files: `backend/config/settings.py`, `backend/accounts/views.py`,
  `backend/accounts/urls.py`.
- Verified live (dev DB, temp user, cleaned up): refresh 200 + rotated `True`,
  old reuse 401, logout 200, post-logout refresh 401.

## B2 Web refresh cookie

- Backend sets the refresh token as an `HttpOnly`, `SameSite=Strict`,
  `Path=/api/v1/auth` cookie (`Secure` when `APP_ENV=production`). Refresh reads
  the cookie when the body is absent; logout clears it and blacklists the token.
- The JSON body still returns `access` + `refresh` so mobile and existing tests
  are unaffected.
- Web (`apps/web/src/lib/api.ts`): access token held **in memory only**; no
  `localStorage` usage at all. A 401 triggers one transparent cookie-based
  refresh (`credentials: "include"`) and retry; on failure it clears state and
  redirects to `/login`.
- Shared client (`packages/api-client/index.ts`): new optional
  `ApiClientOptions` (`credentials`, `refreshAccess`, `onUnauthorized`); dead
  `refresh()` removed; `logout()` now best-effort calls the backend and clears
  tokens.
- Mobile (`apps/mobile/src/lib/api.ts`) unchanged and still uses
  `expo-secure-store` — its constructor omits the options, so behaviour is the
  same.
- `apps/web` `tsc --noEmit` and `packages/api-client` `tsc --noEmit` both pass.

## B3 ReDoS hardening

- Tightened the load-time guard in `security-engine/loader.py`: in addition to
  nested quantifiers and ambiguous repetition, quantified groups whose
  alternatives can match the same prefix (e.g. `(a|a)+`, `(a|ab)+`) are now
  rejected. Disjoint alternations (`(foo|bar)+`, `(?:!|\?){3,}`) are accepted.
  All 20 shipped rules still load.
- Added an intrinsic input bound (`MAX_INPUT_BYTES = 64 KiB`) inside both
  `UrlAnalyzer.analyze` and `MessageAnalyzer.analyze`; oversized input raises
  `InputTooLargeError` regardless of caller (defence-in-depth beyond the
  service-layer 8 KiB check).
- Note: `google-re2` is not available for Python 3.8 here, so the mitigation is
  the tightened static guard plus the analyzer bound rather than an RE2 engine.

## B4 Docker non-root

- Deleted the stray root `Dockerfile` (PHP 8.2 image, `onigurii` typo).
- `backend/Dockerfile`: added `useradd --create-home --uid 10001 amanak`,
  `chown -R amanak:amanak /srv/amanak`, and `USER amanak`.
- Neither compose file uses `privileged`, host networking, `cap_add`, or host PID.

## B5 STATIC_ROOT + SECURE_*

- `STATIC_ROOT = BASE_DIR / "staticfiles"`, `STATIC_URL`, and
  `DATA_UPLOAD_MAX_MEMORY_SIZE = 10 MB`.
- New `_production_security_settings()` returns, only when
  `APP_ENV=production`: `SECURE_SSL_REDIRECT`, `SECURE_PROXY_SSL_HEADER`,
  `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`, HSTS (1 year, subdomains,
  preload), `SECURE_CONTENT_TYPE_NOSNIFF`, `SECURE_REFERRER_POLICY`,
  `X_FRAME_OPTIONS=DENY`, and `CSRF_TRUSTED_ORIGINS` from CORS origins.
- Fixed the compose healthcheck typo `pg_isready -U amakin` →
  `pg_isready -U amanak -d amanak`.

## B6 verify_email + password_reset_confirm

- `register` emails a verify link
  (`/api/v1/auth/verify-email?uid=…&token=…`) built with
  `default_token_generator`; `verify_email` validates `uid`/`token` and sets
  `is_verified` (uses the model's actual field, `is_verified`).
- `password_reset_request` emails a reset link when the account exists and
  returns the same response either way (no enumeration).
- `password_reset_confirm` validates the token, runs Django password
  validators, sets the new password, and **blacklists every outstanding refresh
  token** for the user.
- Email backend is env-driven (`EMAIL_BACKEND`, `EMAIL_HOST*`); console backend
  by default in dev. `.env.example` gained blank `EMAIL_*` + `FRONTEND_URL`
  placeholders (and the P3 AI keys not previously listed).

## Dependency upgrades

`pip-audit 2.7.3` now reports a `fix_version` for all 51 Python advisories.
`backend/requirements.txt` pins the patched releases for Python `>=3.10` via
environment markers; the Python 3.8 developer/CI branch keeps the last
installable release. Production (`python:3.11-slim`) installs the patched set.

| Package | Before | Adv. | Pinned (py≥3.10) | After (prod) |
|---|---|---:|---|---:|
| Django | 4.2.30 | 8 | `>=5.2.17,<6` | 0 |
| djangorestframework | 3.15.2 | 2 | `>=3.17.2` | 0 |
| simplejwt | 5.3.1 | 1 | `>=5.5.1` | 0 |
| Pillow | 10.4.0 | 17 | `>=12.1.1` | 0 |
| PyJWT | 2.9.0 | 16 | `>=2.12.0` | 0 |
| sqlparse | 0.5.5 | 5 | `>=0.6.0` | 0 |
| python-dotenv | 1.0.1 | 1 | `>=1.2.2` | 0 |
| pytest (dev) | 8.3.5 | 1 | `>=9.0.3` | 0 |
| **Total** | | **51** | | **0** |

Details in `docs/security/dependency-audit.md` (new "P5 update" section).

## Production runbook

- `docs/operations/production-runbook.md`: pre-deploy checklist, first/rolling
  deploy, health checks, rollback, PostgreSQL backup/restore, secret rotation,
  incident basics, and the auth/security invariants to preserve.

## Staging dry-run

- `docker-compose.staging.yml`: db/redis publish no host ports; backend runs
  `migrate` + `collectstatic` then gunicorn as the non-root user; `APP_ENV=production`,
  `DJANGO_DEBUG=false`, `AI_ENABLED=false`.
- `docker compose -f docker-compose.staging.yml config -q` → exit 0.
- `docker compose -f docker-compose.staging.yml up --dry-run` → exit 0 (build +
  create plan, no containers started). No production backend container was
  started.

## Test run

```
POSTGRES_HOST=127.0.0.1 pytest -q
214 passed, 1 warning in 41.88s
```

- Baseline: 183 passed. Added 31 P5 tests:
  - `backend/tests/test_auth.py`: +11 (rotation, blacklist, cookie, 5-min
    lifetime, verify email, password reset).
  - `backend/tests/test_settings_security.py`: +4 (prod SECURE_*, static root,
    upload cap).
  - `tests/security/test_redos.py`: +13 (overlapping-alternation guard,
    safe-pattern acceptance, analyzer input bound).
  - `tests/security/test_container_hardening.py`: +3 (PHP Dockerfile removed,
    non-root USER, healthcheck user).
- `apps/web` and `packages/api-client` `tsc --noEmit`: pass. `apps/mobile` has no
  `node_modules` locally, so its typecheck was not run.

## Unresolved

- **Python 3.8 local toolchain.** The patched Python releases require `>=3.10`,
  so the local 3.8 run still reports the original 51 advisories; production
  (3.11) is clean. Recommended follow-up: move dev/CI to Python 3.11 and drop the
  markers.
- **Web `localStorage` no longer holds tokens, but access is memory-only**, so a
  full page reload relies on the cookie refresh round-trip; this is intended but
  means the first `me()` after reload costs one extra request.
- **`google-re2` not adopted** (unavailable on Python 3.8); ReDoS mitigation is
  static-guard + 64 KiB analyzer cap.
- **Node advisories** (`react-router-dom` → 7.18.4 breaking, transitive
  `postcss`) remain planned, non-blocking changes.
- **Live HTTP smoke test** of the web cookie flow was not run through a browser;
  backend cookie behaviour is covered by tests and a live API-level smoke test.
- Working tree is **uncommitted** and **no git remote** is configured.

## Decision Requested

Approve P5 and authorize:
(a) commit + tag `p5-complete`;
(b) add a git remote and push;
(c) begin production deployment.
