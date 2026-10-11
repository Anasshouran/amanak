# AMANAK — TLS Setup (certbot + nginx)

How to obtain and renew Let's Encrypt certificates for the AMANAK production
stack, where TLS terminates at the `nginx` container
(`infrastructure/nginx/amanak.conf`) with certificate material stored in the
`certbot_conf` volume (`/etc/letsencrypt`).

Throughout, replace `your-domain.example` with your real domain and set
`DOMAIN` / `LETSENCRYPT_EMAIL` in `.env.production`.

---

## 1. First-run certificate acquisition (standalone)

nginx cannot start until certificates exist, so request the first certificate
with certbot in **standalone** mode, with nginx **not** running:

```bash
# Stop nginx if it is up (it will crash-loop without certs).
docker compose -f docker-compose.prod.yml stop nginx

# Install certbot on the host.
sudo apt-get update && sudo apt-get install -y certbot

# Request the certificate (port 80 must be free; use --standalone).
sudo certbot certonly --standalone \
  -d your-domain.example \
  --email "$LETSENCRYPT_EMAIL" \
  --agree-tos --no-eff-email
```

Copy the issued material into the bind/volume location the nginx container
mounts as `/etc/letsencrypt`:

```bash
sudo mkdir -p /srv/amanak/certbot/conf /srv/amanak/certbot/www
sudo cp -a /etc/letsencrypt/. /srv/amanak/certbot/conf/
```

Confirm `infrastructure/nginx/amanak.conf` references
`/etc/letsencrypt/live/your-domain.example/{fullchain,privkey}.pem`, then bring
nginx up:

```bash
docker compose -f docker-compose.prod.yml up -d nginx
```

### Alternative: webroot mode

If you prefer not to stop nginx for renewals, use the webroot path that the
HTTP server block already serves (`/.well-known/acme-challenge/` →
`/var/www/certbot`):

```bash
sudo certbot certonly --webroot -w /srv/amanak/certbot/www \
  -d your-domain.example --email "$LETSENCRYPT_EMAIL" \
  --agree-tos --no-eff-email
sudo cp -a /etc/letsencrypt/. /srv/amanak/certbot/conf/
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 2. Renewal

Let's Encrypt certs last 90 days; renew at ~60 days. Pick **one** mechanism.

### Option A — cron

```cron
# /etc/cron.d/amanak-certbot
0 4 * * * root certbot renew --quiet --deploy-hook "cp -a /etc/letsencrypt/. /srv/amanak/certbot/conf/ && docker compose -f /srv/amanak/docker-compose.prod.yml exec -T nginx nginx -s reload"
```

### Option B — systemd timer

```ini
# /etc/systemd/system/amanak-certbot.service
[Unit]
Description=Renew AMANAK TLS certificates

[Service]
Type=oneshot
ExecStart=/usr/bin/certbot renew --quiet \
  --deploy-hook "/usr/bin/cp -a /etc/letsencrypt/. /srv/amanak/certbot/conf/ && \
  /usr/bin/docker compose -f /srv/amanak/docker-compose.prod.yml exec -T nginx nginx -s reload"
```

```ini
# /etc/systemd/system/amanak-certbot.timer
[Unit]
Description=Daily AMANAK certificate renewal check

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now amanak-certbot.timer
```

---

## 3. Reload nginx after renewal

Always reload (never restart) so connections are not dropped:

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

---

## 4. Verification

```bash
# Certificate chain, SANs and expiry:
openssl s_client -connect your-domain.example:443 -servername your-domain.example </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -ext subjectAltName

# Expiry in days:
echo | openssl s_client -connect your-domain.example:443 -servername your-domain.example 2>/dev/null \
  | openssl x509 -noout -enddate

# Protocol check — TLS 1.0/1.1 must FAIL, 1.2/1.3 must succeed:
openssl s_client -connect your-domain.example:443 -tls1_2 -servername your-domain.example </dev/null >/dev/null 2>&1 && echo "TLS1.2 OK"
openssl s_client -connect your-domain.example:443 -tls1_1 -servername your-domain.example </dev/null >/dev/null 2>&1 && echo "TLS1.1 unexpectedly OK" || echo "TLS1.1 refused (good)"
```

---

## 5. Troubleshooting

- **nginx exits immediately**: the `live/` paths in `amanak.conf` do not match
  the issued certificate, or `certbot_conf` is empty — re-run section 1.
- **`certbot renew` no-ops**: `certbot certificates` lists state; renewal only
  acts within 30 days of expiry.
- **Challenge fails on standalone**: port 80 is in use (nginx still running) or
  DNS does not yet point at the host.
- **Browser still shows old cert**: hard-reload; check `docker compose ... logs nginx`.
