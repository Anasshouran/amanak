# AMANAK — أمانك

A defensive personal-cybersecurity platform. AMANAK helps individuals
understand and reduce their digital exposure: scan links and messages, watch for
data breaches, keep devices and accounts in view, manage 2FA and passwords, and
train security awareness — across a web app, a mobile app and a single API.

> Defensive by design: breach monitoring is opt-in, the password vault and 2FA
> secrets are server-blind (end-to-end encrypted), and the AI gateway is
> disabled by default.

## Features

| Area | What it does |
| --- | --- |
| Dashboard & security score | Aggregated posture with trends and recommendations |
| Scanner | Phishing/scam analysis for URLs and messages, with optional AI explanation |
| Breach monitor | Opt-in, privacy-preserving breach checks (HIBP-style) |
| Devices & incidents | Inventory of devices and security incidents |
| Accounts | Inventory of online accounts and exposure |
| 2FA manager (`/vault`) | Server-blind TOTP storage/secrets |
| Password vault | Server-blind, E2E-encrypted passwords |
| Family protection | Guardianship/family safeguards |
| Awareness | Security-training scenarios and progress |
| Billing | Plans, subscription management and usage |
| Notifications | In-app notification feed |
| Staff console | Role-gated moderation, users, tickets, audit log, metrics, subscriptions, announcements |

## Repository layout

```
amanak/
├── apps/
│   ├── web/            # React + Vite + TypeScript web app
│   └── mobile/         # React Native + Expo (Expo Router) app
├── backend/            # Django + DRF API (accounts, scanner, devices, incidents, …)
│   └── apps/           # ai_assistant, breach_monitor, notifications, two_factor,
│                       # password_vault, family, awareness, billing, staff
├── packages/
│   ├── shared-types/   # Shared TypeScript contracts
│   ├── api-client/     # Typed fetch client (error shape { code, message, details })
│   └── design-system/  # Shared UI/design tokens
├── security-engine/    # Rules, analyzers, reputation, redaction
├── ai/                 # Provider-agnostic AI gateway, prompts, evals (disabled by default)
├── infrastructure/     # Docker, Nginx, monitoring, scripts
├── tests/              # Integration + security test suite (pytest)
└── docs/               # Architecture, API, security, operations, ADRs (bilingual)
```

## Tech stack

- **Backend** — Python (prod 3.11, dev/CI 3.8), Django 5.x/4.2 + Django REST
  Framework, SimpleJWT, PostgreSQL, Redis, Celery, Gunicorn; Nginx in front.
- **Web** — React 18, Vite, TypeScript, React Router; Vitest + Testing Library,
  Playwright for E2E.
- **Mobile** — React Native + Expo (Expo Router), TypeScript, `@noble` crypto,
  `expo-secure-store` for tokens.
- **Shared** — `@amanak/shared-types`, `@amanak/api-client`, `@amanak/design-system`.
- **Infra** — Docker Compose (local / staging / prod), Nginx, optional Uptime Kuma.

## Status

Active development on a phased roadmap. The current milestone is **P16.1
(security score trend chart)**.

| Suite | Count | Command |
| --- | --- | --- |
| Backend (pytest) | 404 | `POSTGRES_HOST=127.0.0.1 pytest -q` |
| Web (Vitest) | 101 | `npm test -w @amanak/web` |
| Mobile (Vitest) | 46 | `npm test -w @amanak/mobile` |
| Web E2E (Playwright) | staff + core flows | `npm run e2e -w @amanak/web` |

## Quick start

### Option A — Docker stack (local, production-like)

Runs Postgres, Redis, the backend, and Nginx (the API is exposed on `:8080`):

```bash
cp .env.example .env
docker compose -p amanak-local \
  -f docker-compose.prod.yml \
  -f docker-compose.local-prod.yml \
  -f docker-compose.local-prod.ports.yml \
  up -d
curl http://localhost:8080/healthz/        # {"status": "ok"}
```

### Option B — Backend on SQLite (no Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_demo          # optional demo data (demo@amanak.local)
python manage.py runserver 0.0.0.0:8000
```

API base `http://localhost:8000/api/v1` · Admin `http://localhost:8000/admin/`.

### Web app

```bash
npm install                         # once, from the repo root (workspaces)
npm run dev:web                     # http://localhost:5173
```

### Mobile app

```bash
npm run dev:mobile                  # Expo dev server (i / a / w to launch)
```

## Running the tests

Always run the backend suite from the **repository root** — the root `pytest.ini`
collects both `backend/tests/` and `tests/security/`:

```bash
POSTGRES_HOST=127.0.0.1 pytest -q
```

Web and mobile:

```bash
npm run typecheck                   # all workspaces
npm test -w @amanak/web
npm test -w @amanak/mobile
```

### End-to-end (Playwright)

The E2E suite drives the web app against the Docker backend. Each page load
refreshes the session, which exceeds the production auth throttle of 20/min, so
target a backend running with `DJANGO_DEBUG=true` and a raised
`AUTH_THROTTLE_RATE` (only overridable in debug; production always enforces
20/min):

```bash
cd apps/web
npx playwright install --with-deps chromium   # once
npm run e2e
```

## Configuration

Copy `.env.example` to `.env` and fill in values. Notable groups:

- **App / Django** — `APP_ENV`, `DJANGO_SECRET_KEY`, `DJANGO_ALLOWED_HOSTS`,
  `DJANGO_CORS_ORIGIN_WHITELIST`.
- **Database / Redis** — `DB_*`, `REDIS_HOST`, `REDIS_PORT`.
- **Security engine** — `RULES_DIRECTORY`, `REPUTATION_ENABLED`.
- **AI gateway** — `AI_ENABLED=false` by default; `AI_PROVIDER`, `AI_API_KEY`, …
- **Breach monitor** — `BREACH_MONITOR_ENABLED=False` by default; `HIBP_API_KEY`.
- **Email** — `EMAIL_*`, `PUBLIC_BASE_URL` for verification/reset links.

## API overview

Base path `api/v1/`; `healthz/` is unauthenticated. Auth is JWT-only
(`JWTAuthentication` + a validated staff-impersonation class); Django
`SessionAuthentication` is intentionally **not** enabled on the API.

```
auth/            register, login, refresh-token, logout, verify-email, password-reset-*
me/              current user
dashboard/       security score + summary
accounts/        online-account inventory (user-scoped CRUD)
devices/         device inventory (user-scoped CRUD)
incidents/       incident tracking (user-scoped CRUD)
scan/            url, message, history
ai/              explain-scan, guidance            (disabled by default)
breach/          check, hits                       (opt-in)
two-factor/      server-blind 2FA
password-vault/  server-blind password vault
family/          family protection
awareness/       categories, scenarios, answer, progress, reset
billing/         plans, subscription, usage
notifications/   list, mark-read
staff/           users, moderation, tickets, audit, metrics, subscriptions, announcements
```

Full specification: [`docs/api/openapi.yaml`](docs/api/openapi.yaml).

## Security

- Server-blind 2FA and password vault (client-side crypto).
- Opt-in, privacy-preserving breach monitoring.
- JWT-only API authentication; rate-limited auth endpoints.
- See [`docs/security/security-baseline.md`](docs/security/security-baseline.md).

## Documentation

- [Architecture](docs/architecture/initial-architecture.md)
- [API (OpenAPI)](docs/api/openapi.yaml)
- [Security baseline](docs/security/security-baseline.md)
- [Local development](docs/operations/local-development.md)
- [Deployment](docs/operations/deployment.md)
- [Production runbook](docs/operations/production-runbook.md)
- [Architecture decisions (ADRs)](docs/decisions/)
- Arabic index: [`docs/README.ar.md`](docs/README.ar.md) · [`README.ar.md`](README.ar.md)

## Contributing

- Keep the two test suites green (see above) and run the linters/typecheckers
  before opening a change.
- Documentation is maintained bilingually (`*.md` and `*.ar.md`).
- Significant decisions are recorded as ADRs in `docs/decisions/`.
- Agents/automation should follow [`AGENTS.md`](AGENTS.md).
