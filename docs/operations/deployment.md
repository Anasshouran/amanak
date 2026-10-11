# AMANAK — Deployment Guide

This guide takes a fresh host to a running production AMANAK stack using
`docker-compose.prod.yml` (backend + PostgreSQL + Redis + nginx). For day-2
operations see `production-runbook.md`; for TLS specifics see `tls-setup.md`.

---

## 1. Prerequisites

**Host sizing.** For a small launch, provision:

- **2 vCPU, 4 GB RAM, 80 GB SSD** (e.g. Hetzner CX22 / DO `s-2vcpu-4gb`).
- AMANAK's scanning workload is **CPU-bound under burst load**; if you expect
  sustained concurrent scans, size CPU up before RAM.

**OS.** A current 64-bit Linux (Ubuntu 22.04/24.04 LTS or Debian 12) with:

- Docker Engine ≥ 24 and the Compose v2 plugin.
- A non-root sudo user (`deploy`).
- Outbound HTTPS access (image pulls, email, optional AI).

**DNS.** Point an `A` (and `AAAA` if IPv6) record for your domain at the host's
public IP **before** requesting certificates:

```bash
dig +short your-domain.example
```

**Ports.** `80` and `443` reachable from the internet; everything else closed.

---

## 2. Host bootstrap

```bash
# As root, once.
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy   # copy your key

# Docker Engine + compose plugin
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
  | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | tee /etc/apt/sources.list.d/docker.list >/dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker deploy
```

**Firewall (ufw):**

```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

**fail2ban** (SSH brute-force protection):

```bash
apt-get install -y fail2ban
cat >/etc/fail2ban/jail.d/sshd.local <<'EOF'
[sshd]
enabled = true
maxretry = 5
bantime = 1h
findtime = 10m
EOF
systemctl enable --now fail2ban
```

Re-login as `deploy` (so the docker group applies) before continuing.

---

## 3. Clone and configure

```bash
sudo mkdir -p /srv && sudo chown deploy:deploy /srv
git clone git@github.com:swnamhmd/amanak.git /srv/amanak
cd /srv/amanak

cp .env.production.example .env.production
```

Edit `.env.production` and set **at minimum**:

- `DJANGO_SECRET_KEY` — generate with
  `python3 -c 'import secrets; print(secrets.token_urlsafe(64))'`.
- `DJANGO_ALLOWED_HOSTS` and `CORS_ALLOWED_ORIGINS` — your real domain(s).
- `POSTGRES_PASSWORD` — a strong random value.
- `DOMAIN`, `LETSENCRYPT_EMAIL`, and `EMAIL_*` (SMTP) values.

`.env.production` is gitignored; never commit it. Also replace every
`your-domain.example` in `infrastructure/nginx/amanak.conf`.

---

## 4. TLS bootstrap (first run)

nginx will not start until certificates exist, so acquire the first cert with
certbot in **standalone** mode (no nginx). Full detail in `tls-setup.md`:

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone \
  -d your-domain.example \
  --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email

# Copy the issued material into the certbot_conf volume location used by nginx.
sudo mkdir -p /srv/amanak/certbot/conf /srv/amanak/certbot/www
sudo cp -a /etc/letsencrypt/. /srv/amanak/certbot/conf/
```

---

## 5. First deploy

```bash
cd /srv/amanak
docker compose -f docker-compose.prod.yml up -d --build
```

On start the `backend` container runs `migrate`, then `collectstatic`, then
`gunicorn`. `nginx` starts once certificates are mounted and begins publishing
`80`/`443`.

---

## 6. Verify

```bash
HOST=your-domain.example ./infrastructure/scripts/healthcheck.sh
```

Expect all five checks to pass. If the `backend` healthcheck is still
`starting`, give it ~30 s (`start_period`) and retry. Also spot-check:

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS https://your-domain.example/healthz/        # {"status": "ok"}
curl -s -o /dev/null -w '%{http_code}\n' \
  -X POST https://your-domain.example/api/v1/scan/url \
  -H 'Content-Type: application/json' -d '{"input":"x"}'   # 401
```

---

## 7. Enable daily backups

```bash
sudo mkdir -p /backups && sudo chown deploy:deploy /backups
```

Install a cron entry for the `deploy` user:

```cron
# m  h  dom mon dow   command
17   3  *   *   *    cd /srv/amanak && ./infrastructure/scripts/backup.sh >> /var/log/amanak-backup.log 2>&1
```

Backups land in `/backups` and are retained 14 daily / 8 weekly. **Copy them
off-host** and encrypt at rest (see `backup-restore.md`).

---

## 8. Enable monitoring

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
# Reach Uptime Kuma via SSH tunnel only:
ssh -L 3001:127.0.0.1:3001 deploy@your-domain.example
```

See `infrastructure/monitoring/README.md`.

---

## 9. Upgrade procedure

```bash
cd /srv/amanak
git fetch --tags
git checkout <new-tag>                       # e.g. p6-complete
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml run --rm backend \
  python backend/manage.py migrate --no-input
docker compose -f docker-compose.prod.yml up -d
HOST=your-domain.example ./infrastructure/scripts/healthcheck.sh
```

Migrations in this project are additive; the previous image keeps serving until
the new `backend` container replaces it.

---

## 10. Rollback procedure

```bash
cd /srv/amanak
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d
HOST=your-domain.example ./infrastructure/scripts/healthcheck.sh
```

If a migration must be reverted, **take a backup first**, then
`python backend/manage.py migrate <app> <previous>`. A code rollback alone does
not require reverting migrations.

---

## 11. Decommission

```bash
cd /srv/amanak
docker compose -f docker-compose.prod.yml down       # keeps volumes
# Final backup before destroying data:
./infrastructure/scripts/backup.sh

# Destroy containers AND data (irreversible):
docker compose -f docker-compose.prod.yml down -v
```

Then remove the DNS record, revoke host access keys, cancel the server, and
delete any off-host backups once retention policy allows.
