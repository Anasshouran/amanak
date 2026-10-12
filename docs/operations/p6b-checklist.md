# P6B — Cloud Deployment Checklist

Goal: take the P6 production stack (`docker-compose.prod.yml`) from this repo to a
live host, following `deployment.md`. This file is the concrete, ordered task list
with the exact commands to run. State: **plan only** — no host has been reached yet.

---

## 0. Required inputs (fill in before starting)

| Input | Value | Source |
|---|---|---|
| Provider | ? | provision a 2 vCPU / 4 GB / 80 GB Ubuntu 24.04 VPS (`deployment.md` §1) |
| Host public IPv4 | ? | after provisioning |
| SSH key | ? | your existing key; copied to the `deploy` user on the host |
| Domain (A record) | ? | must resolve to the host IP before TLS |
| `LETSENCRYPT_EMAIL` | ? | admin address for cert expiry notices |
| SMTP settings | ? | `EMAIL_BACKEND`, `EMAIL_HOST*` — console backend is dev-only (runbook) |
| Monitoring | default: Uptime Kuma (no external dependency) |

Throughout: replace `amanak.example` with the real domain.

---

## 1. Repo preparation (this repository, before deployment)

- [x] **`docker-compose.monitoring.yml` exists** at the repo root (single `uptime-kuma`
      service bound to `127.0.0.1:3001` only — never `0.0.0.0` — on the `amanak`
      network, with a named `uptime_kuma_data` volume). Validated:
      `docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml config` → ok.
- [ ] **Replace every `your-domain.example` in `infrastructure/nginx/amanak.conf`**
      (6 occurrences: `server_name` x2 and the cert paths in the 443 block) with
      the real domain. Commit this with the rest of the P6B changes once the
      domain is known.
- [ ] `git fetch --tags` and confirm the deployment target tag (`p6.1`/`p7.4-complete`).
- [ ] Optional (runbook): leave `AI_ENABLED=false` unless AI is explicitly approved.

---

## 2. Provision the host

Sizing (from `deployment.md` §1): **2 vCPU / 4 GB RAM / 80 GB SSD**, Ubuntu 24.04,
current 64-bit Linux. CPU-bound scans → size CPU up before RAM on sustained load.

| Provider | SKU |
|---|---|
| Hetzner | CX22 |
| DigitalOcean | `s-2vcpu-4gb` |
| AWS | `t3.medium` (arm64 `t4g.medium` if preferred) |
| Linode | `g6-standard-2` |

**DNS** (before TLS):

```bash
dig +short amanak.example        # must print the host IPv4
```

Also add `AAAA` if the host has IPv6. Keep ports 80/443 public; everything else closed.

---

## 3. Host bootstrap (as root, once)

```bash
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy        # copy your key

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

# Firewall
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# fail2ban (SSH brute force)
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

Re-login as `deploy` (so the docker group applies).

---

## 4. TLS bootstrap (first run, before nginx exists)

```bash
sudo apt-get install -y certbot
sudo certbot certonly --standalone \
  -d amanak.example \
  --email "$LETSENCRYPT_EMAIL" --agree-tos --no-eff-email

sudo mkdir -p /srv/amanak/certbot/conf /srv/amanak/certbot/www
sudo cp -a /etc/letsencrypt/. /srv/amanak/certbot/conf/
```

Renewal hook (nightly), per `tls-setup.md`:

```cron
0 4 * * * root certbot renew --quiet --deploy-hook "cp -a /etc/letsencrypt/. /srv/amanak/certbot/conf/ && docker compose -f /srv/amanak/docker-compose.prod.yml exec -T nginx nginx -s reload"
```

---

## 5. Clone and configure secrets

```bash
sudo mkdir -p /srv && sudo chown deploy:deploy /srv
git clone git@github.com:swnamhmd/amanak.git /srv/amanak
cd /srv/amanak
git checkout p7.4-complete
cp .env.production.example .env.production
```

Populate `.env.production` (`production-runbook.md` §1):

```bash
python3 -c "import secrets; print(secrets.token_urlsafe(64))"   # DJANGO_SECRET_KEY
python3 -c "import secrets; print(secrets.token_urlsafe(32))"   # POSTGRES_PASSWORD
```

| Variable | Value |
|---|---|
| `APP_ENV` | `production` |
| `DEBUG` | `False` |
| `DJANGO_SECRET_KEY` | ≥ 50 chars, ≥ 5 unique chars (**never** the dev key) |
| `DJANGO_ALLOWED_HOSTS` | the real domain, e.g. `amanak.example,www.amanak.example` (never `*`) |
| `CORS_ALLOWED_ORIGINS` | `https://amanak.example` (also feeds `CSRF_TRUSTED_ORIGINS`) |
| `POSTGRES_*` | real values; `POSTGRES_PASSWORD` strong random |
| `REDIS_URL` | `redis://redis:6379/1` (DB 1 = throttle counters) |
| `EMAIL_BACKEND` / `EMAIL_HOST*` | real SMTP (never console) |
| `DOMAIN` | `amanak.example` |
| `LETSENCRYPT_EMAIL` | admin email |
| `AI_ENABLED` | `False` unless approved |
| `BREACH_MONITOR_ENABLED` | `False` until a real `HIBP_API_KEY` is set (blind-mode off) |

`.env.production` is gitignored — never commit it.

---

## 6. First deploy

```bash
cd /srv/amanak
docker compose -f docker-compose.prod.yml up -d --build
```

Startup runs `migrate` → `collectstatic` → `gunicorn`; nginx starts once certs are mounted.

---

## 7. Verify (definition of done for P6B)

```bash
HOST=amanak.example ./infrastructure/scripts/healthcheck.sh      # all five checks PASS
```

Spot checks (`production-runbook.md` §3):

```bash
curl -fsS https://amanak.example/healthz/                                  # {"status": "ok"}
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://amanak.example/api/v1/scan/url \
  -H 'Content-Type: application/json' -d '{"input":"x"}'                  # 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://amanak.example/api/v1/ai/guidance \
  -H 'Content-Type: application/json' -d '{}'                              # 503 (AI disabled)

docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml run --rm backend python backend/manage.py check --database default
docker compose -f docker-compose.prod.yml run --rm backend python backend/manage.py showmigrations --plan
docker compose -f docker-compose.prod.yml exec -T redis redis-cli -n 1 ping  # PONG
```

Pre-deploy signoff (`production-runbook.md` §1) — run on the host checkout:

- [ ] `python3 backend/manage.py check --deploy` returns **zero warnings** (`W009` = short key)
- [ ] `pip-audit -r backend/requirements.txt` reviewed
- [ ] browser smoke test: register, login/logout, scanner scan, theme/locale, breach opt-in

---

## 8. Backups

```bash
sudo mkdir -p /backups && sudo chown deploy:deploy /backups
```

Cron (user `deploy`):

```cron
17   3  *   *   *   cd /srv/amanak && ./infrastructure/scripts/backup.sh >> /var/log/amanak-backup.log 2>&1
```

- [ ] One run completed successfully, artifact lands in `/backups`
- [ ] Restore drill done (`infrastructure/scripts/restore.sh`, see `backup-restore.md`)
- [ ] Off-host encrypted copy scheduled (14 daily / 8 weekly retained)

---

## 9. Monitoring

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
ssh -L 3001:127.0.0.1:3001 deploy@amanak.example       # open http://127.0.0.1:3001
```

Monitors (`infrastructure/monitoring/README.md`):
- `https://amanak.example/healthz/` → 200
- `POST https://amanak.example/api/v1/scan/url` → 401
- alert on 2 consecutive failures + cert expiry ≤ 14 days

Never expose Uptime Kuma to `0.0.0.0`.

---

## 10. Day-2 references

- Upgrades / rollbacks: `deployment.md` §9–§10
- Operations: `docs/operations/production-runbook.md`
- Backup/restore: `docs/operations/backup-restore.md`
- Incident response: `docs/operations/incident-response.md`