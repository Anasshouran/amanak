# AMANAK AI Privacy Model (P3)

The AI Assistant is **provider-agnostic** and **disabled by default**. Nothing
leaves the process unless `AI_ENABLED` is explicitly turned on. This document
describes the guarantees the code enforces, not aspirations.

## Default posture

- `AI_ENABLED=false` (default). All `/api/v1/ai/*` endpoints return
  `503` with body `{"code": "ai_disabled"}`. The attempt is logged without any
  input content.
- The default provider is `NullProvider`, which refuses every call with
  `AIDisabledError`.
- No outbound network call is made anywhere in the test suite. Tests use
  `FakeProvider`, an offline deterministic provider.

## What is sent to a provider

Only after redaction, and only ever:

- `explain-scan`: a prompt built from **scan metadata** — verdict, score,
  ruleset version, and the rule id/severity/description of each match. The raw
  scanned input is never stored (P2) and never sent. Scan history is never sent.
- `guidance`: a prompt built from the requested **topic** and curated, offline
  knowledge-base entries.

Redaction runs in `AIProvider.complete()` (the base class) via
`security-engine/redact.py::cap(redact(...))`, so no subclass — real or fake —
can observe unredacted PII. Context string values are redacted as well.

## What is never sent or stored

- Raw user input from scans.
- Scan history.
- Credentials, passwords, one-time codes, recovery codes, or MFA secrets. The
  product never asks for them.
- Raw prompts or raw responses in logs. Provider failures are logged generically
  (`ai_provider_failure kind=… provider=…`) with no content.
- Raw prompts or raw responses in the database. `AIConversation` stores only
  `prompt_hash`, `response_hash`, provider, model, token count, kind, owner, and
  timestamp.

## Access control

- Every AI endpoint requires authentication.
- `explain-scan` resolves the scan with `ScanResult.objects.filter(id=…,
  user=request.user)`; a scan owned by another user returns `404`.
- `AIConversation` rows are owner-scoped.

## Rate limiting

Two limits compose, backed by the shared Redis cache (DB 1):

| Scope    | Limit                | Key            |
| -------- | -------------------- | -------------- |
| ai_user  | 10 requests / minute | per user       |
| ai_daily | `AI_DAILY_LIMIT`/day (default 100) | global |

Exceeding a limit returns `429`.

## Configuration

| Variable           | Default | Meaning                                   |
| ------------------ | ------- | ----------------------------------------- |
| `AI_ENABLED`       | false   | Master switch.                            |
| `AI_FAKE_PROVIDER` | false   | Use the offline fake provider (tests).    |
| `AI_PROVIDER`      | (empty) | `openai` or `anthropic` when enabled.     |
| `AI_API_KEY`       | (empty) | Provider credential (never logged).       |
| `AI_BASE_URL`      | (empty) | Provider endpoint (stubs validate it).    |
| `AI_MODEL`         | (empty) | Override the provider default model.      |
| `AI_TIMEOUT`       | 15      | Per-call timeout, seconds.                |
| `AI_MAX_TOKENS`    | 1024    | Per-call token budget.                    |
| `AI_DAILY_LIMIT`   | 100     | Global rolling-day request cap.           |

## Provider status

`openai_provider.py` and `anthropic_provider.py` are **stubs**: they validate
configuration and then refuse. No transport is implemented in this phase, so
they cannot make real network calls. Real transports and provider keys are out
of scope for P3.
