# AMANAK — Backup & Restore

PostgreSQL is the system of record; Redis holds only throttle counters (safe to
lose, but snapshotted anyway). Backups are produced by
`infrastructure/scripts/backup.sh` and restored by
`infrastructure/scripts/restore.sh`.

> **Warning.** Backups contain user data (accounts, scan history, incidents).
> Encrypt them at rest and store an off-host copy.

---

## 1. Where backups live

| Path | Contents | Format |
|---|---|---|
| `/backups/postgres/amanak-YYYY-MM-DD-HHMM.sql.gz` | `pg_dump` of the DB | gzip'd SQL |
| `/backups/redis/dump-YYYY-MM-DD-HHMM.rdb` | Redis snapshot | RDB |
| `/backups/weekly/amanak-weekly-YYYY-WW.sql.gz` | one weekly copy of the PG dump | gzip'd SQL |

Retention: **14 daily** and **8 weekly** copies (pruned by the script). Override
with `BACKUP_ROOT`, `DAILY_RETENTION`, `WEEKLY_RETENTION`.

---

## 2. Trigger a backup manually

```bash
cd /srv/amanak
./infrastructure/scripts/backup.sh
```

The script reads `POSTGRES_DB`/`POSTGRES_USER` from `.env.production` (and the
containers' own environment), streams `pg_dump` through gzip, takes a Redis
`BGSAVE` snapshot, writes a weekly copy, then prunes old copies. It exits
non-zero on any failure and logs each step with a UTC timestamp.

**Scheduled** (recommended): the cron entry in `deployment.md` runs it nightly
at 03:17. Keep the schedule on the `deploy` user, not root.

---

## 3. Encrypt at rest

Backups must not sit unencrypted on disk or in off-host storage. Encrypt before
copying off-host, e.g. with [age](https://age-encryption.org/):

```bash
age -r "$(cat /srv/amanak/.backup-recipient.pub)" \
  -o /backups/postgres/amanak-2026-10-11-0317.sql.gz.age \
     /backups/postgres/amanak-2026-10-11-0317.sql.gz

# Off-host (rclone / restic / object storage):
rclone copy /backups/ remote:amanak-backups/
```

(Store the age private key offline, not on the production host.) `gpg --encrypt`
works equally well if age is unavailable.

---

## 4. Restore to the same host

```bash
cd /srv/amanak
./infrastructure/scripts/restore.sh /backups/postgres/amanak-2026-10-11-0317.sql.gz
```

The script stops `backend`, drops and recreates the database, restores the dump,
and starts `backend`. It **requires typing `yes`** — it never runs
automatically. Verify afterwards:

```bash
HOST="$DOMAIN" ./infrastructure/scripts/healthcheck.sh
```

---

## 5. Restore to a fresh host

1. Bootstrap the host and clone the repo (`deployment.md` sections 2–3).
2. Bring up **only** the database: `docker compose -f docker-compose.prod.yml up -d db`.
3. Copy the encrypted backup over and decrypt it.
4. Restore:
   ```bash
   ./infrastructure/scripts/restore.sh /path/to/amanak-YYYY-MM-DD-HHMM.sql.gz
   ```
5. Finish the deploy: `docker compose -f docker-compose.prod.yml up -d` (runs
   migrations), then `healthcheck.sh`.

Redis counters can be discarded; if you restored `dump.rdb`, place it in the
`redis_data` volume instead.

---

## 6. Verify a backup (do this regularly)

Restore into a **scratch** database and count a known table — never trust a
backup you have not restored:

```bash
cd /srv/amanak
gunzip -c /backups/postgres/amanak-2026-10-11-0317.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T db \
      sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS restore_verify;" \
             -c "CREATE DATABASE restore_verify;"'
gunzip -c /backups/postgres/amanak-2026-10-11-0317.sql.gz \
  | docker compose -f docker-compose.prod.yml exec -T db \
      sh -c 'psql -U "$POSTGRES_USER" -d restore_verify'

docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d restore_verify -tAc "SELECT count(*) FROM accounts_user;"'

docker compose -f docker-compose.prod.yml exec -T db \
  sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE restore_verify;"'
```

A non-zero user count proves the dump is restorable. Automate a monthly
"restore drill" and record the result.
