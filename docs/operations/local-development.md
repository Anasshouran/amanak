# Local Development

## P1 status (Core MVP)

The P1 core MVP is implemented and verified:

- **Backend** (Django + DRF): custom `User` model (email login), JWT auth
  (register / login / refresh-token / verify-email / password-reset-*),
  user-scoped CRUD for accounts, devices and incidents, dashboard +
  security-score endpoints. Auth endpoints are rate-limited.
- **Tests**: 29 pytest tests (auth flow + strict cross-user isolation),
  91% coverage across app modules.
- **Seed**: `python manage.py seed_demo` creates `demo@amanak.local` with
  sample accounts/devices/incidents and recomputes the demo security score.
- **Mobile** (`apps/mobile`): Expo Router app with Welcome / Login / Register /
  Dashboard / Accounts / Devices / Incidents screens; tokens in
  `expo-secure-store`.
- **Web** (`apps/web`): React + Vite app with the same screens; tokens in
  localStorage (fine for local dev; swap for HttpOnly cookies in production).
- **Shared packages**: `packages/shared-types` (TS contracts) and
  `packages/api-client` (typed fetch client, error shape `{ code, message, details }`).

## Prerequisites

- Python 3.8+ (backend is developed against 3.8.10)
- Node.js 20+ (mobile and web)
- Docker and Docker Compose (optional — for Postgres/Redis; not required for
  local sqlite backend)

## Backend (quick start, sqlite)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate          # fresh database
python manage.py seed_demo        # optional demo data
python manage.py runserver 0.0.0.0:8000
```

- API base: `http://localhost:8000/api/v1`
- Admin: `http://localhost:8000/admin/`
- Live API spec: `docs/api/openapi.yaml`

### Running the tests

```bash
cd backend
python -m pytest                          # full suite
python -m pytest tests/test_isolation.py  # security isolation tests
python -m pytest --cov=accounts --cov=devices --cov=incidents --cov=security_score
```

## Web app

```bash
npm install                     # once, from repo root
cd apps/web && npm run dev      # http://localhost:5173, proxies /api to :8000
```

## Install (monorepo)

From the repository root once:

```bash
npm install                # installs packages/*, apps/* + hoists to root node_modules
cd backend && pip install -r requirements.txt
```

The root `package.json` ships an npm `overrides` entry pinning
`react-native` to the Expo SDK 51-compatible version. Do not remove it —
without it npm can pull @expo/vector-icons' much newer react-native into the
tree, breaking Metro bundling.

## Mobile app

```bash
cd apps/mobile
npm run start      # = EXPO_USE_METRO_WORKSPACE_ROOT=1 expo start
```

- Metro is configured for the monorepo via `apps/mobile/metro.config.js`
  (watchFolders + root node_modules) and the `EXPO_USE_METRO_WORKSPACE_ROOT=1`
  env baked into `npm run start`. Keep both in sync with the repo layout.
- Scan the QR with Expo Go, run `npm run android`/`ios for emulators, or
  `npm run web`.
- `apps/mobile/src/lib/api.ts` points at `127.0.0.1:8000` (and `10.0.2.2` on
  the Android emulator). On a physical device set `API_URL` to your LAN IP.

> Note: this sandbox installs with `--ignore-scripts` (native-module
> postinstall steps do not run), which is fine for bundling; on a normal dev
> machine the standard `npm install` runs everything.

## Using Docker Compose (Postgres + Redis + backend)

The compose file runs Postgres 15 and Redis on localhost (127.0.0.1-only
bindings) plus a Django backend. `docker compose` itself is not preinstalled
on all systems; install the compose plugin first or run only the `db`/`redis`
services.

```bash
docker compose up -d db redis
cp .env.example .env   # configure DATABASE_URL etc. as needed
```

## Environment Variables

Copy `.env.example` to `.env` and configure as needed. The backend currently
runs on sqlite with DEBUG=true by default for local development; production
must override `DEBUG`, `SECRET_KEY`, `ALLOWED_HOSTS` and use Postgres (see
`docs/architecture/security-baseline.md`).

## Key security notes for P1

- Every user-scoped queryset filters by `request.user`; verified by the
  isolation tests in `tests/test_isolation.py`.
- The `Account` model stores only metadata — never third-party passwords or
  MFA codes (asserted by a dedicated test).
- A separate production settings module and real secrets handling are P4 work.