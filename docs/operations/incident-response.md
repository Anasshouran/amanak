# AMANAK — Incident Response Plan

Minimum viable incident response for the AMANAK production stack
(`docker-compose.prod.yml`). Keep this short enough to follow under pressure.

---

## 1. Contacts

| Role | Who | Channel |
|---|---|---|
| Incident commander | _(fill in)_ | _(phone / Signal)_ |
| Platform / on-call | _(fill in)_ | _(phone / Signal)_ |
| Security owner | _(fill in)_ | _(email)_ |
| Hosting provider support | _(fill in)_ | provider portal |
| Registrar / DNS | _(fill in)_ | registrar account |

Record every action with a UTC timestamp in a single incident log.

---

## 2. Severity triage

- **SEV1** — data loss/corruption, credential compromise, or full outage.
- **SEV2** — partial outage, auth broken, or sustained 5xx.
- **SEV3** — degraded performance, isolated errors.

SEV1/SEV2: page the on-call and start the log immediately.

---

## 3. Take the service down safely

Cut public ingress while preserving state for forensics:

```bash
# Stop the public entrypoint (backend and DB keep running).
docker compose -f docker-compose.prod.yml stop nginx

# If backend itself is compromised, stop it too (DB/Redis remain up).
docker compose -f docker-compose.prod.yml stop backend
```

Avoid `down -v` unless you intend to destroy data. Before any redeploy, snapshot
the database (`./infrastructure/scripts/backup.sh`) and copy logs (section 6).

---

## 4. Rotate the Django SECRET_KEY (invalidates all JWTs)

Access and refresh tokens are signed with `SECRET_KEY`, so rotating it invalidates
**every** outstanding JWT and session at once.

```bash
cd /srv/amanak
NEW_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(64))')"
sed -i "s|^DJANGO_SECRET_KEY=.*|DJANGO_SECRET_KEY=${NEW_KEY}|" .env.production
docker compose -f docker-compose.prod.yml up -d --force-recreate backend nginx
HOST="$DOMAIN" ./infrastructure/scripts/healthcheck.sh
```

All users must log in again. Communicate this proactively.

---

## 5. Rotate the database password

The `POSTGRES_PASSWORD` environment variable only applies at first
initialisation, so you must also change the role password in PostgreSQL:

```bash
cd /srv/amanak
NEW_DB_PASS="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"

docker compose -f docker-compose.prod.yml exec -T db \
  sh -c "psql -U \"\$POSTGRES_USER\" -d postgres -c \"ALTER USER \\\"\$POSTGRES_USER\\\" WITH PASSWORD '${NEW_DB_PASS}';\";"

sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${NEW_DB_PASS}|" .env.production
docker compose -f docker-compose.prod.yml up -d --force-recreate backend
HOST="$DOMAIN" ./infrastructure/scripts/healthcheck.sh
```

---

## 6. Where logs live

- Application/nginx logs: Docker's stdout capture —
  `docker compose -f docker-compose.prod.yml logs --since 1h <service>`.
- If the `journald` log driver is enabled: `journalctl -u docker --since "1 hour ago"`.
- Aggregate with Loki/Promtail if deployed
  (see `infrastructure/monitoring/README.md`).
- Preserve evidence **before** recreating containers:
  ```bash
  docker compose -f docker-compose.prod.yml logs > /root/incident-$(date -u +%F-%H%M).log
  ./infrastructure/scripts/backup.sh
  ```

Never paste secrets or tokens into tickets/chat.

---

## 7. Revoke a user's tokens

Password resets blacklist that user's refresh tokens. To revoke **all** of a
user's outstanding refresh tokens immediately:

```bash
docker compose -f docker-compose.prod.yml exec -T backend \
  python backend/manage.py shell -c "
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
uid = <USER_ID>
for t in OutstandingToken.objects.filter(user_id=uid):
    BlacklistedToken.objects.get_or_create(token=t)
print('revoked')
"
```

Outstanding access tokens expire within 5 minutes; rotating `SECRET_KEY`
(section 4) revokes them immediately if the situation demands it.

---

## 8. Common playbooks

**Suspected credential leak (e.g. token/secret in a public place).** Revoke the
credential at the source (GitHub PAT, provider key), rotate the corresponding
AMANAK secret (sections 4–5), review access logs, then reissue.

**ReDoS / scanner abuse.** The loader rejects nested/overlapping quantifiers at
startup and analyzers cap input at 64 KiB. If abuse continues, disable the scan
endpoints by stopping `nginx` and inspect `security-engine/rules/` diffs before
restarting.

**Database corruption.** Stop `backend`, take a snapshot, restore the most
recent good backup via `restore.sh` (`backup-restore.md`), then verify.

---

## 9. After the incident

- Write a blameless post-mortem within 5 business days (timeline, root cause,
  impact, detection, remediation).
- Add a regression test or monitor for the failure mode.
- Update this plan and the runbook with anything that slowed you down.
