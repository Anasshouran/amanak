# AMANAK Breach Monitor Privacy Model (P7)

The Breach Monitor is **opt-in**, **provider-agnostic**, and **disabled by
default**. An email is handed to a provider only while `BREACH_MONITOR_ENABLED`
is on, only after the user gives explicit consent per address. This document
describes the guarantees the code enforces, not aspirations.

## Default posture

- `BREACH_MONITOR_ENABLED=false` (default). List endpoints return `200 []` so
  the API never reveals whether monitoring is configured. Mutating endpoints
  (`POST`/`DELETE`) and `POST /api/v1/breach/check/` return `503` with body
  `{"code": "breach_monitor_disabled"}`. The attempt is logged without the
  email address.
- The default provider is `NullProvider`, which refuses every call with
  `BreachMonitorDisabledError`.
- No outbound network call is made anywhere in the test suite. Tests use
  `FakeProvider`, an offline deterministic provider.

## Consent

- Adding a monitored email requires `consent: true`. A missing or false flag
  returns `400 {"code": "consent_required"}` and stores nothing. Consent is
  recorded as `consent_given_at` on the row.

## What is sent to a provider

Only ever the address the user explicitly added, and only over the wire to the
configured provider (HIBP by default) during a check. Request shape:

- `GET https://haveibeenpwned.com/api/v3/breachedaccount/{email}`
- Headers: `hibp-api-key`, `User-Agent: AMANAK/1.0`, `Accept: application/json`
- Timeout `BREACH_MONITOR_TIMEOUT` (default 8s); a `429` is retried with
  exponential backoff, at most 2 retries.

## What is never sent or stored

- The raw provider response. Only the fields the product needs are mapped into
  `BreachHit`.
- Raw addresses in logs. Provider calls and failures are logged as
  `breach_provider_call` / `breach_provider_failure` with
  `email_hash=sha256(email)[:8]`; the raw email is never logged nor embedded in
  an error message.
- Credentials, passwords, one-time codes, or MFA secrets. The product never
  asks for them.

## Storage

- `MonitoredEmail`: owner, address, label, active flag, `consent_given_at`,
  timestamps. Unique per `(user, email)`.
- `BreachHit`: monitored email, breach `name`, `domain`, `breach_date`,
  `pwn_count`, `data_classes`, `is_verified`, `first_seen_at`,
  `last_checked_at`. Unique per `(monitored_email, name)` so re-checks update
  rather than duplicate. No raw payload is retained.

## Access control

- Every breach endpoint requires authentication.
- All reads and the delete are owner-scoped. `DELETE` on a row owned by another
  user returns `404` (existence is not leaked).
- Deleting a monitored email cascades to its hits.

## Rate limiting

Backed by the shared Redis cache (DB 1):

| Scope             | Limit                | Key            |
| ----------------- | -------------------- | -------------- |
| `breach_check_user` | 2 requests / minute | per user       |
| `breach_check_ip`   | 5 requests / minute | per IP         |
| `breach_add_user`   | 10 requests / minute| per user       |

Exceeding a limit returns `429`. While the feature is disabled, throttles are
skipped so a deterministic `503` consumes no budget.

## Configuration

| Variable                     | Default | Meaning                                  |
| ---------------------------- | ------- | ---------------------------------------- |
| `BREACH_MONITOR_ENABLED`     | false   | Master switch.                           |
| `BREACH_FAKE_PROVIDER`       | false   | Use the offline fake provider (tests).   |
| `HIBP_API_KEY`               | (empty) | HIBP credential (never logged).          |
| `BREACH_MONITOR_TIMEOUT`     | 8       | Per-call timeout, seconds.               |
| `BREACH_MONITOR_MAX_EMAILS`  | 5       | Max monitored emails per user.           |

## Provider status

The real provider is `HIBPProvider`, a stdlib `urllib` client (no new
dependency). When `HIBP_API_KEY` is absent it raises `BreachProviderError`,
surfaced as a generic `502` with no email content.

## Known limitation — synchronous check

`POST /api/v1/breach/check/` performs all HIBP lookups synchronously.
With max 5 monitored emails and an 8-second per-request timeout, the
worst case is ~40 seconds (below nginx's 60s proxy_read_timeout).

P8 will move this to Celery and return a job id immediately.
