# AMANAK — Production Runbook

Day-2 operating guide for the production stack (`docker-compose.prod.yml`:
`db`, `redis`, `backend`, `nginx`). It assumes the image built from
`backend/Dockerfile` (Python 3.11, non-root user `amanak`, UID 10001). For
first-time setup see `deployment.md`.

## 0. Topology at a glance

| Service | Image | Host ports | Reachable from |
|---|---|---|---|
| `nginx` | `nginx:1.27-alpine` | `80`, `443` | the internet (sole ingress) |
| `backend` | `backend/Dockerfile` | none | nginx, on the `amanak` network |
| `db` | `postgres:15-alpine` | none | the `amanak` network |
| `redis` | `redis:7-alpine` | none | the `amanak` network |

Secrets live only in `.env.production` (gitignored). `APP_ENV=production` makes
`config.settings` fail fast when `DJANGO_SECRET_KEY`, explicit
`DJANGO_ALLOWED_HOSTS`, or CORS origins are missing.

## 1. Pre-deploy checklist

- [ ] `APP_ENV=production`, `DEBUG=False`.
- [ ] `DJANGO_SECRET_KEY` is strong and unique (never the dev key).
- [ ] `DJANGO_ALLOWED_HOSTS` lists explicit hostnames (never `*`).
- [ ] `CORS_ALLOWED_ORIGINS` lists explicit https origins (also used for
      `CSRF_TRUSTED_ORIGINS`).
- [ ] `POSTGRES_*` set; `POSTGRES_PASSWORD` strong.
- [ ] `REDIS_URL` points at Redis DB 1 (throttle counters).
- [ ] `EMAIL_BACKEND`/`EMAIL_HOST*` set (console backend is dev-only).
- [ ] `DOMAIN` and every `your-domain.example` in `infrastructure/nginx/amanak.conf`
      replaced.
- [ ] `AI_ENABLED=false` unless AI is explicitly approved.
- [ ] `pip-audit -r backend/requirements.txt` reviewed (Python 3.11 patched set).

## 2. Start / stop the stack

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs --tail=100 backend
docker compose -f docker-compose.prod.yml down        # keeps volumes
```

## 3. Health checks

`./infrastructure/scripts/healthcheck.sh` runs, in order: containers up/healthy,
`GET /healthz/` → 200, unauthenticated `POST /api/v1/scan/url` → 401, Redis
`PONG`, PostgreSQL `SELECT 1` → 1. It exits non-zero on any failure.

| Check | Command | Expected |
|---|---|---|
| Containers | `docker compose -f docker-compose.prod.yml ps` | all running; health-checked services healthy |
| Liveness | `curl -fsS https://$DOMAIN/healthz/` | `{"status": "ok"}` |
| Auth enforced | unauthenticated `POST /api/v1/scan/url` | `401` |
| DB reachable | `... run --rm backend python backend/manage.py check --database default` | no issues |
| Migrations | `... run --rm backend python backend/manage.py showmigrations --plan` | none unapplied |
| Throttle cache | `... exec redis redis-cli -n 1 ping` | `PONG` |
| AI disabled | `POST /api/v1/ai/guidance` | `503` while `AI_ENABLED=false` |

## 4. Logs

Access/error logs for nginx go to stdout/stderr; backend logs likewise. Read
them with `docker compose -f docker-compose.prod.yml logs -f <service>`. On the
host, `journalctl` can aggregate container logs (see
`infrastructure/monitoring/README.md`).

## 5. Routine deploy (rolling)

1. `git fetch --tags && git checkout <new-tag>`
2. `docker compose -f docker-compose.prod.yml build backend`
3. `docker compose -f docker-compose.prod.yml run --rm backend python backend/manage.py migrate --no-input`
4. `docker compose -f docker-compose.prod.yml up -d`
5. Run `healthcheck.sh`; keep the previous image tag until traffic is clean.

## 6. Rollback

```bash
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d
./infrastructure/scripts/healthcheck.sh
```

Migrations are additive; a code rollback does not require reverting migrations.
Take a backup before any destructive migration change.

## 7. Backup and restore

- Manual backup: `./infrastructure/scripts/backup.sh` → `/backups` (14 daily,
  8 weekly). Scheduled via cron (see `deployment.md`).
- Restore: `./infrastructure/scripts/restore.sh /backups/postgres/amanak-.....sql.gz`
  (manual only; prompts for `yes`).
- Details, off-host copy and encryption: `backup-restore.md`.

## 8. TLS renewal

Certificates renew via certbot (cron/systemd timer) and nginx is reloaded after
renewal. Full procedure and verification in `tls-setup.md`.

## 9. Monitoring

Default: Uptime Kuma bound to `127.0.0.1:3001` via the monitoring overlay. See
`infrastructure/monitoring/README.md`. Alert on `/healthz/`, the 401 scan
probe, and certificate expiry.

## 10. Secret rotation

- **Django secret key**: changing `DJANGO_SECRET_KEY` invalidates all JWTs and
  sessions; rotate in a maintenance window and expect re-authentication.
- **Database password**: `ALTER USER <user> WITH PASSWORD ...`, update
  `.env.production`, then
  `docker compose -f docker-compose.prod.yml up -d --force-recreate db backend`.
- **Email credentials**: update `EMAIL_HOST_PASSWORD`, restart `backend`.
- **JWT invalidation for a user**: password reset blacklists that user's refresh
  tokens; individual JTIs can be added to the blacklist table directly.

## 11. Incident basics

1. **Contain**: `docker compose -f docker-compose.prod.yml stop nginx` (or
   scale backend) if an exploit is suspected.
2. **Preserve evidence**: capture `docker compose logs` and a DB snapshot
   before redeploying.
3. **Revoke**: rotate `DJANGO_SECRET_KEY` and the DB password.
4. **Pivot on the scanner/ReDoS guard**: the loader rejects nested/overlapping
   quantifiers at startup and the analyzers cap input at 64 KiB.
5. Full plan: `incident-response.md`.

## 12. Auth / security invariants to preserve

- Access tokens: 5 minutes, HS256, signed with `SECRET_KEY`.
- Refresh tokens: 7 days, rotated on every refresh; old JTI blacklisted; logout
  blacklists the presented refresh token (`token_blacklist` tables must be
  migrated).
- Web refresh token travels in an `HttpOnly`, `SameSite=Strict`,
  `Path=/api/v1/auth` cookie (`Secure` in production); access token is held in
  memory only.
- Mobile clients receive the refresh token in the JSON body
  (`expo-secure-store`).
- The backend container runs as UID 10001, never root.
- AI stays disabled until explicitly enabled with provider credentials.

## 13. Related documents

- `deployment.md` — first-time setup.
- `tls-setup.md` — certbot / certificate renewal.
- `backup-restore.md` — backup, restore, encryption.
- `incident-response.md` — incident response plan.
- `infrastructure/monitoring/README.md` — monitoring options.
- `docs/security/dependency-audit.md`, `docs/security/P5-production-readiness.md`.
