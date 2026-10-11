# AMANAK — Production Runbook (P5)

Operational guide for running the AMANAK backend in production. It assumes the
container image built from `backend/Dockerfile` (Python 3.11, non-root user
`amanak`, UID 10001) and the staging overlay `docker-compose.staging.yml`.

## 1. Pre-deploy checklist

- [ ] `APP_ENV=production` (this activates `config.settings` fail-fast guards).
- [ ] `DJANGO_DEBUG=false`.
- [ ] `DJANGO_SECRET_KEY` set to a strong, unique value (not the dev key).
- [ ] `DJANGO_ALLOWED_HOSTS` lists explicit hostnames (never `*`).
- [ ] `CORS_ALLOWED_ORIGINS` lists explicit https origins (used for CORS and
      `CSRF_TRUSTED_ORIGINS`).
- [ ] `POSTGRES_HOST`/`POSTGRES_PORT`/`POSTGRES_DB`/`POSTGRES_USER`/
      `POSTGRES_PASSWORD` set.
- [ ] `REDIS_URL` points at Redis DB 1 (throttle counters).
- [ ] `EMAIL_BACKEND`/`EMAIL_HOST*` set so verification and reset mail is sent
      (default console backend is dev-only).
- [ ] `FRONTEND_URL` set (used to build verification/reset links).
- [ ] `AI_ENABLED=false` unless AI is explicitly approved.
- [ ] `pip-audit -r backend/requirements.txt` reviewed; image built on Python
      3.11 so the patched dependency set is installed.

The settings module raises `ImproperlyConfigured` at import time and the
container exits non-zero if any production guard above is unmet.

## 2. First deploy

```bash
DJANGO_SECRET_KEY=... \
DJANGO_ALLOWED_HOSTS=amanak.example.com \
CORS_ALLOWED_ORIGINS=https://amanak.example.com \
POSTGRES_PASSWORD=... \
  docker compose -f docker-compose.staging.yml up -d --build
```

The backend entrypoint runs `migrate` then `collectstatic` then gunicorn.
Verify:

```bash
docker compose -f docker-compose.staging.yml ps
docker compose -f docker-compose.staging.yml logs --tail=100 backend
curl -fsS https://amanak.example.com/api/v1/health/   # if a health route exists
```

## 3. Routine deploy (rolling)

1. Build the new image and run migrations as a one-shot:
   `docker compose -f docker-compose.staging.yml run --rm backend python manage.py migrate --no-input`
2. `docker compose -f docker-compose.staging.yml up -d --no-deps backend`
3. Confirm readiness with the health endpoint and application logs.
4. Keep the previous image tag until the new one has served traffic cleanly.

## 4. Health checks

| Check | Command | Expected |
|---|---|---|
| Containers up | `docker compose -f docker-compose.staging.yml ps` | `backend` running, `db`/`redis` healthy |
| DB reachable | `... run --rm backend python manage.py check --database default` | `System check identified no issues` |
| Migrations applied | `... run --rm backend python manage.py showmigrations --plan` | no unapplied |
| Throttle cache | `redis-cli -n 1 ping` (inside network) | `PONG` |
| Auth smoke | `POST /api/v1/auth/login/` | 200 + `Set-Cookie: amanak_refresh` |
| AI disabled | `POST /api/v1/ai/guidance` | 503 while `AI_ENABLED=false` |

## 5. Rollback

Application rollback:

```bash
docker compose -f docker-compose.staging.yml up -d --no-deps <previous-image/tag>
```

- Database migrations in this project are additive; a code rollback does not
  require reverting migrations. If a migration must be reverted, take a backup
  first (section 6) and use `python manage.py migrate <app> <previous>`.
- Verify auth (login + one authenticated request) after rollback.

## 6. Backup and restore (PostgreSQL)

Backup:

```bash
docker compose -f docker-compose.staging.yml exec -T db \
  pg_dump -U "$POSTGRES_USER" -Fc "$POSTGRES_DB" > amanak_$(date +%F).dump
```

Restore:

```bash
docker compose -f docker-compose.staging.yml stop backend
cat amanak_2026-10-11.dump | docker compose -f docker-compose.staging.yml exec -T db \
  pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists
docker compose -f docker-compose.staging.yml start backend
```

Back up the volume `pg_data_staging` before any destructive operation and store
dumps encrypted off-host.

## 7. Secret rotation

- **Django secret key**: changing `DJANGO_SECRET_KEY` invalidates all existing
  JWTs (signed with it) and sessions. Rotate during a maintenance window; users
  re-authenticate. Prefer a rollout where the old and new keys overlap only if a
  key-rotation mechanism is added.
- **Database password**: update the secret store, `ALTER USER ... PASSWORD`,
  then redeploy `backend` with the new value.
- **Email credentials**: update `EMAIL_HOST_PASSWORD` and restart `backend`.

## 8. Incident basics

1. **Contain**: scale the backend to zero or take it out of the load balancer if
   an active exploit is suspected.
2. **Preserve evidence**: copy logs and a database snapshot before
   redeploying.
3. **Revoke**: rotate `DJANGO_SECRET_KEY` and the DB password; this invalidates
   outstanding tokens. Any user whose password may be exposed should be reset
   (a password reset also blacklists that user's refresh tokens).
4. **Pivot on the scanner/ReDoS guard**: if a malicious rule pattern is
   suspected, the loader rejects nested/overlapping quantifiers at startup; the
   analyzers also cap input at 64 KiB. Inspect `rules/` changes before restart.
5. **Communicate** status to stakeholders; record a timeline.

## 9. Auth / security invariants to preserve

- Access tokens: 5 minutes, HS256, signed with `SECRET_KEY`.
- Refresh tokens: 7 days, **rotated on every refresh**, old JTI blacklisted;
  logout blacklists the presented refresh token. Applies to the
  `token_blacklist` tables — ensure migrations are applied.
- Web refresh token is transported in an `HttpOnly`, `SameSite=Strict`,
  `Path=/api/v1/auth` cookie (`Secure` in production). Access token is held in
  memory only; no refresh token is stored in `localStorage`.
- Mobile clients continue to receive the refresh token in the JSON body and
  store it in `expo-secure-store`.
- The backend container must run as UID 10001, never root.
- AI stays disabled until explicitly enabled and provider credentials are set.

## 10. Related documents

- `docs/security/security-baseline.md`
- `docs/security/P4-security-audit.md`
- `docs/security/dependency-audit.md`
- `docs/operations/deployment.md`
