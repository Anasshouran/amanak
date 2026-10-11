# AMANAK — P4 Security Acceptance Audit

Date: 2026-10-11
Auditor role: Senior Application Security Engineer
Commit under audit: `59ec33a` (tag `p3-complete`)
Method: static review + targeted dynamic/exploit tests on Postgres 15 (docker
`127.0.0.1:5433`) and Redis (`127.0.0.1:6380`). No features added.

## Prerequisites

| Check | Result |
|---|---|
| Tags `p1-complete`, `p2-complete`, `p3-complete` | present |
| `docker compose ps` (db + redis healthy on 5433 / 6380) | pass |
| `POSTGRES_HOST=127.0.0.1 pytest -q` baseline | 171 passed |
| `docker compose config` exit 0 | pass |
| `AI_ENABLED=False` in `.env` | pass |

## Authentication

- Global DRF defaults: `JWTAuthentication` + `SessionAuthentication`, permission
  `IsAuthenticated` (`backend/config/settings.py:249-255`). Every endpoint outside
  `/api/v1/auth/` requires auth; the six public auth routes are declared via
  `get_permissions()` (`backend/accounts/views.py:34-45`). Verified: no `AllowAny`
  endpoint exists outside the intended auth surface.
- **JWT is left entirely on library defaults** — there is **no `SIMPLE_JWT`
  dict** anywhere: HS256, access 5 min, refresh 1 day, **no rotation**, and
  `rest_framework_simplejwt.token_blacklist` is **not installed** (no
  revocation/logout). Signing key is `SECRET_KEY`, which previously fell back to
  a committed dev literal. (Finding; see Fixes/Deferred.)
- Auth throttling: `AuthRateThrottle(AnonRateThrottle)` scope `auth` 20/min
  (`backend/accounts/views.py:25-32`). Caveat: it is anonymous/IP-only, so an
  **authenticated** caller of `refresh-token` is not bound by the `auth` scope
  (still bound by the global `user: 1000/day`). Anonymous login/register remain
  IP-throttled.
- Two public auth endpoints are non-functional stubs: `verify_email`
  (`backend/accounts/views.py:88-94`, always returns `{"status":"verified"}`) and
  `password_reset_confirm` (`:110-112`, performs no reset). Deferred (product).
- Auth behaviour confirmed by `backend/tests/test_auth.py` (401 for
  `/me/`, `/dashboard/`; token round-trip; reset no-enumeration).

## Isolation

- Every detail lookup goes through a user-scoped queryset
  (`Account/Device/Incident.objects.filter(user=request.user)`,
  `backend/accounts/views.py:128-129`, `devices/views.py:14-16`,
  `incidents/views.py:14-16`); `scanner.history` filters by user
  (`backend/scanner/views.py:74`); AI `explain-scan` uses
  `ScanResult.objects.filter(id=..., user=user).first()`
  (`backend/apps/ai_assistant/views.py:80`). Cross-user access returns **404**
  (no existence leak), never 403.
- New adversarial tests (guessed/adjacent integer PKs) added — all pass:
  - `backend/tests/test_isolation.py::test_adjacent_id_probing_never_leaks`
    (accounts/devices/incidents, probes `id-1`, `id`, `id+1`, `id+4242` → 404)
  - `backend/tests/test_isolation.py::test_scanresult_queryset_is_owner_scoped`
  - `backend/tests/test_isolation.py::test_aiconversation_queryset_is_owner_scoped`
  - `backend/tests/test_ai_endpoints.py::test_ai_adjacent_scan_id_probing_404`
- Existing isolation suites re-run green: `backend/tests/test_isolation.py`,
  `test_scanner_isolation.py`, `test_ai_endpoints.py`,
  `tests/security/test_isolation_scan.py`.

## Input handling

- API-layer: `ScanRequestSerializer.input` bounded at `max_length=8192`
  (`backend/scanner/serializers.py:6`); byte cap `MAX_INPUT_LEN=8192`
  (`backend/scanner/services.py:15,47`); match cap `MAX_MATCHES=50`
  (`:16,61`). Password fields now bounded at 128 (fix).
- Analyzer layer: analyzers do **not** bound length intrinsically; the 8192 cap
  lives only in the backend wrapper. Analyzers enforce a per-rule budget
  (`DEFAULT_PER_RULE_BUDGET_MS=200`) and total budget (`2000 ms`)
  (`security-engine/analyzers/url_analyzer.py:22-24`, `message_analyzer.py:18-20`),
  but the budget is checked around, not during, `pattern.search()` — cooperative,
  not preemptive.
- Control/binary: strict UTF-8 encode + control-byte reject + control-char strip
  (`backend/scanner/services.py:19-20,44-51`); covered by
  `backend/tests/test_scanner.py` (null/`\x01` rejected, VT/FF stripped).
- **Confirmed defect (fixed):** a lone surrogate (e.g. `"\ud800"`) made
  `raw.encode("utf-8", errors="strict")` raise `UnicodeEncodeError` → unhandled
  500. Now returns `400 invalid_input`.
- ReDoS: suite `tests/security/test_redos.py` asserts per-rule < 50 ms and full
  scan < 500 ms on a 10-string adversarial corpus (up to 5000 chars). Rules are
  compiled with Python `re`, not RE2 (`security-engine/loader.py:101`) despite
  "RE2-safe" comments; a static nested-quantifier check rejects `(...*)+` /
  `a*+` shapes (`loader.py:62-69`) but misses overlapping alternations
  (`(a|a)+`). Deferred (engine hardening).
- Dangerous primitives: **none** — no `eval`/`exec`/`subprocess`/`os.system`/
  `shell=True`/`pickle.loads`/insecure `yaml.load` in first-party code; only
  `yaml.safe_load` is used.

## Secrets and config

- Hardcoded-secret scan (entropy + provider patterns, excluding
  `node_modules/.git/.env`) found **none**.
- `.env` is gitignored (`.gitignore:7-8`). **Confirmed defect (fixed):** the
  `*.env*` rule also ignored `.env.example`, so the template was not tracked
  (untracked). Added `!.env.example`.
- `.env.example` contains only blank/placeholder values (no real secrets).
  Constraint honoured: file not modified.
- **Confirmed defect (fixed):** production path did **not** fail fast. Under
  `APP_ENV=production` the settings now refuse to start if `DJANGO_SECRET_KEY` is
  unset/equal to the insecure default, `DJANGO_ALLOWED_HOSTS` is empty/`*`, or no
  CORS origin is configured (`backend/config/settings.py:236-267`). Non-production
  (default `APP_ENV=local`) is unaffected.
- `DEBUG` defaults to `False` (`backend/config/settings.py:55`).
- **Confirmed defect (fixed):** `CORS_ALLOWED_ORIGINS` defaulted to the string
  `""` (django-cors-headers expects a list); now defaults to `[]`.
- Missing hardening still deferred: `SESSION_COOKIE_SECURE`,
  `CSRF_COOKIE_SECURE`, `SECURE_SSL_REDIRECT`, HSTS, `SECURE_PROXY_SSL_HEADER`,
  `DATA_UPLOAD_MAX_MEMORY_SIZE`. CORS middleware is last in `MIDDLEWARE`
  (recommended high).

## Dependencies

See `docs/security/dependency-audit.md`. Totals: Python 51 advisories across 8
packages (advisory DB reported no fixed versions at scan time); Node root
workspace aggregate 80 (1 critical, 44 high, 34 moderate, 1 low — Expo/RN/Metro
toolchain); `apps/web` 3 (1 high, 2 moderate); shared packages 0.

## Docker and network

- `docker-compose.yml`: db `127.0.0.1:5433:5432`, redis `127.0.0.1:6380:6379`,
  backend `127.0.0.1:8000:8000` — all **loopback-bound**.
- Healthchecks present for db and redis (`docker-compose.yml:14-18,26-30`).
- No `privileged`, `network_mode: host`, `cap_add`, or `pid: host` (verified).
- **Finding:** neither Dockerfile sets `USER` (`backend/Dockerfile`, root
  `Dockerfile`) → containers run as root. Deferred (deploy hardening).
- **Finding:** root `Dockerfile` is a stray PHP image (`php:8.2-fpm-alpine`,
  `onigurii` typo) unused by compose; `backend/Dockerfile` is the real one.
- **Finding:** `backend/` compose service runs `collectstatic` but `STATIC_ROOT`
  is not defined in settings. Deferred (deploy).
- Minor: db healthcheck uses `pg_isready -U amakin` (user typo; still returns OK).

## AI privacy

- `AI_ENABLED=False` → `/api/v1/ai/*` returns `503 {"code":"ai_disabled"}` for
  both endpoints, after auth (401 wins for anonymous). Verified live and by test.
- Redaction runs before any provider call: `AIProvider.complete` applies
  `cap(redact(prompt), 4000)` and redacts context (`ai/gateway/provider.py:83`);
  test injects PII and asserts it never reaches `provider.last_prompt`.
- No raw prompt/response persisted — `AIConversation` stores only
  `prompt_hash`/`response_hash`/`tokens_used` (`backend/apps/ai_assistant/models.py`);
  logs are content-free (`views.py:45`, `services.py:97-101`).
- Provider stubs refuse before any transport
  (`ai/gateway/openai_provider.py:25-30`, `anthropic_provider.py:19-24`).
- AI endpoints throttled (`ai_user` 10/min + global `ai_daily`), verified 429.
- All covered by `backend/tests/test_ai_endpoints.py`, `test_ai_gateway.py`,
  `test_ai_eval.py`.

## Logging

- Only two log calls repo-wide, both content-free: `ai_disabled_attempt
  user_id=...` (`backend/apps/ai_assistant/views.py:45`) and `ai_provider_failure
  kind=... provider=...` (`services.py:97-101`). No `LOGGING`/`dictConfig`.
- No `logger.*input|prompt|password`, no `print`/stderr in backend/ or
  security-engine/. Dev console email backend embeds the reset email address in a
  console email (dev only).

## Frontend

- Mobile tokens: `expo-secure-store` (`apps/mobile/src/lib/api.ts:7,13-29`,
  plugin at `app.json:20`) — secure. **PASS**
- Web tokens: `localStorage` for access **and refresh**
  (`apps/web/src/lib/api.ts:18,21,24-25`) — XSS-exposed. Deferred (architectural:
  move refresh to httpOnly cookie).
- No hardcoded secrets in `apps/` or `packages/`; only `VITE_API_URL` exposed.
- 401 handling: client-side guards redirect when `user` is null
  (`apps/web/src/components/ProtectedRoute.tsx:6-8`,
  `apps/mobile/app/(tabs)/_layout.tsx:8-13`), but there is **no 401 interceptor /
  refresh-on-401**; `packages/api-client` throws on non-OK with no 401 branch
  (`packages/api-client/index.ts:71-89`), and `api.refresh()` is dead code
  (`:109-116`). Deferred.
- No `dangerouslySetInnerHTML` / `eval` / `new Function` in web source; AI and
  scan output rendered as React text nodes (auto-escaped).

## Fixes applied

| # | Defect | Fix (minimal) |
|---|---|---|
| 1 | Lone surrogate → unhandled `UnicodeEncodeError` (500) | `backend/scanner/services.py`: try/except `UnicodeEncodeError` → `(None, "input is not valid UTF-8")` |
| 2 | No production fail-fast for SECRET_KEY / ALLOWED_HOSTS / CORS | `backend/config/settings.py`: `_INSECURE_SECRET_KEY`, `APP_ENV`, `_enforce_production_hardening(...)` called at load |
| 3 | `CORS_ALLOWED_ORIGINS` default was `""` (string) | `backend/config/settings.py`: list-comprehension default `[]` |
| 4 | `.env.example` unintentionally gitignored | `.gitignore`: added `!.env.example` |
| 5 | Unbounded password fields (hash DoS) | `backend/accounts/serializers.py`: `max_length=128` (register + login) |

No Scanner rules/analyzers were modified. `.env.example` untouched. No commit.

## Deferred

- Enable JWT refresh rotation + blacklist app; set explicit `SIMPLE_JWT`
  algorithm/lifetimes; revocation/logout.
- Web refresh token → httpOnly cookie; 401 interceptor + auto-refresh.
- Docker: non-root `USER`, remove stray PHP `Dockerfile`, set `STATIC_ROOT`,
  production `SECURE_*` / HSTS / cookie flags, reorder CORS middleware.
- Dependency upgrades (Django/DRF/PyJWT/Pillow/sqlparse; react-router-dom 7).
- Analyzer intrinsic length bound + ReDoS-hardened engine (RE2 or richer static
  analysis); preemptive per-rule timeout.
- Bounded password/login (`DATA_UPLOAD_MAX_MEMORY_SIZE`) and auth-throttle for
  authenticated refresh calls.
- Implement `verify_email` / `password_reset_confirm` (currently stubs).

## Test run

- `POSTGRES_HOST=127.0.0.1 pytest -q` → **183 passed** (baseline 171 + 12 new)
- Adversarial isolation → 4 new tests passed (3 in `test_isolation.py`, 1 in
  `test_ai_endpoints.py`)
- Baseline reproduced: 171
