# Monitoring for AMANAK (P6)

The default monitoring choice for a single-VPS AMANAK deployment is **Uptime
Kuma**, with a structured JSON logging path that can be aggregated by
`journald` or Loki. Sentry is documented as the recommended add-on for backend
error tracking.

## Options considered

| Option | Type | Best for | Trade-off |
|---|---|---|---|
| **Uptime Kuma** (chosen) | Self-hosted uptime/alerting | Single VPS, no external dependency, alerting to email/Telegram/webhook | You must run and back it up |
| Sentry (free tier) | Hosted error tracking | Backend exceptions, stack traces, release tracking | Third-party data processor; needs a DSN |
| JSON logs + journald/Loki | Log aggregation | Querying/retaining `docker logs` | No alerting on its own |

## Default: Uptime Kuma

Run it with the overlay:

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.monitoring.yml up -d
```

`docker-compose.monitoring.yml` adds a single `uptime-kuma` service bound to
`127.0.0.1:3001`. It is **not** exposed publicly — reach the UI through an SSH
tunnel:

```bash
ssh -L 3001:127.0.0.1:3001 deploy@your-domain.example
# then open http://127.0.0.1:3001
```

Recommended monitors in Uptime Kuma:

- `https://your-domain.example/healthz/` — expect HTTP 200 (`status: ok`).
- `POST https://your-domain.example/api/v1/scan/url` — expect HTTP 401
  (proves auth middleware is enforcing and the app is reachable).
- TCP `db:5432` and `redis:6379` on the compose network, if the monitor runs
  inside the stack.

Alert on: 2 consecutive failures, plus certificate expiry ≤ 14 days.

## Structured logs

The backend and nginx both log to stdout/stderr (`docker logs`), so configure
the host's log driver to aggregate them:

- simplest: install the `journald` log driver for the compose project
  (`logging.driver: journald`) and query with `journalctl`.
- richer: run Loki + Promtail (or Grafana Alloy) and ship container logs to
  Loki, with Grafana for dashboards.

Keep log retention bounded (e.g. `journalctl --vacuum-time=14d`) and never log
secrets or tokens.

## Sentry (optional)

Backend errors can additionally be shipped to Sentry by setting `SENTRY_DSN` in
`.env.production` **after** the Sentry SDK integration is added to
`config.settings`. Until then, treat JSON logs as the source of truth.

## What not to do

- Do not publish Uptime Kuma (or Grafana/Loki) to `0.0.0.0`.
- Do not add `privileged`, `network_mode: host`, or extra capabilities to
  monitoring containers.
- Do not point monitors at `db`/`redis` from outside the compose network.
