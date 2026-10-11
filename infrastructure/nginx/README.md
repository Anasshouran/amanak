# nginx for AMANAK (P6)

`amanak.conf` is the reverse proxy / TLS terminator for the production stack
(`docker-compose.prod.yml`). It is mounted read-only at
`/etc/nginx/conf.d/default.conf` inside the `nginx` container.

## What it does

| Concern | Handling |
|---|---|
| Plain HTTP | `301` redirect to HTTPS, except `/.well-known/acme-challenge/` (certbot webroot) |
| TLS | TLS 1.2 + 1.3 only, modern ECDHE cipher list, session cache, no tickets |
| HSTS | `max-age=31536000; includeSubDomains; preload` |
| Proxying | `/api/`, `/admin/`, `/healthz/` → `backend:8000` with `X-Forwarded-Proto https` |
| Static files | `/static/` served from the `staticfiles` volume (`/var/www/static`) |
| Media | `/media/` served from the `media` volume (`/var/www/media`) |
| Body limit | `client_max_body_size 10m` (matches `DATA_UPLOAD_MAX_MEMORY_SIZE`) |
| Timeouts | `proxy_read_timeout 30s` |
| Logs | access → stdout, error → stderr (visible via `docker logs`) |

## Before deploying

1. Replace every `your-domain.example` in `amanak.conf` with the real domain.
   Set the same value as `DOMAIN` in `.env.production`.
2. Obtain certificates first (nginx will not start without the cert files on the
   HTTPS listener): see `docs/operations/tls-setup.md`.
3. Then: `docker compose -f docker-compose.prod.yml up -d nginx`.

## Reloading

After a certificate renewal, reload nginx without dropping connections:

```bash
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
```

## Notes

- `/static/` is populated by `collectstatic` when the `backend` container
  starts; nginx mounts the same `staticfiles` volume read-only.
- The backend already redirects to HTTPS (`SECURE_SSL_REDIRECT`); nginx passes
  `X-Forwarded-Proto https` so Django sees the original scheme.
- Only ports `80` and `443` are published by the production stack. `db`,
  `redis`, and `backend` are reachable solely on the internal `amanak` network.
