# AMANAK AI Privacy Model (P20.4 — Hybrid: Cloud + Local)

The AI Assistant supports two operating modes. The default (`AI_ENABLED=false`)
remains unchanged: nothing leaves the device, nothing is transmitted, and all
`/api/v1/ai/*` endpoints return `503 {"code":"ai_disabled"}`.

When enabled, the gateway selects the provider based on `AI_PROVIDER` and
`AI_CLOUD_CONSENT`.

## Mode A — Local (Ollama)

Used when `AI_PROVIDER=ollama` (default model: `llama3.1:8b`).

- **No external transmission**: inference runs on the operator's Ollama instance.
- **Redaction**: the lighter `redaction_cloud` is applied (emails, phones, secrets,
but URLs preserved for quality). The prompt is still capped to 4000 chars.
- **No consent required** beyond `AI_ENABLED=true`.

## Mode B — Cloud (Anthropic, Groq)

Used when `AI_PROVIDER=anthropic` (model: `claude-3-5-haiku`) or `groq` (model:
`llama-3.3-70b-versatile`).

**Requirements** (both must be true; fail-closed otherwise):
- `AI_ENABLED=true`
- `AI_CLOUD_CONSENT=true`
- `ANTHROPIC_API_KEY` (for Anthropic) or `GROQ_API_KEY` (for Groq) present
- `AI_PROVIDER` set to the provider name

**Privacy floor (P20.4)**:
- **Aggressive redaction** (`security-engine/redaction_cloud.py`): before any
  cloud transmission, the assembled prompt is stripped of:
  - Emails (`[email redacted]`)
  - Phone numbers (`[phone redacted]`)
  - Token-like secrets (`[token redacted]`)
  - **Full URLs** (`[redacted-url]` — host + query, the primary evidence in
    phishing scans)
- **No raw input stored** or transmitted: `build_explain_scan_prompt()` builds
  from scan metadata (verdict, score, match descriptions), never the raw URL.
- **No PII in DB**: `AIConversation` stores `prompt_hash`, `response_hash`,
  provider, model, tokens, `kind`, owner, timestamp. No raw content.
- **Rate limits**: `ai_user`: 10/min per user; `ai_daily`: `AI_DAILY_LIMIT`/day
  (default 100) global rolling cap.
- **No content in logs**: provider failures are generic (`ai_provider_error`);
  disabled attempts log `user_id` only.
- **Access control**: `explain-scan` resolves scans via
  `ScanResult.objects.filter(id=..., user=user)`; cross-user access returns 404.

### What is never sent or stored (both modes)
- Raw user input from scans.
- Scan history.
- Credentials, passwords, one-time codes, recovery codes, MFA secrets.
- Raw prompts or raw responses in logs or DB.

### Provider status endpoint
`GET /api/v1/ai/status/` returns:
- `enabled`: bool
- `provider`: configured provider name (or `None`)
- `model`: configured model
- `is_cloud`: `true` when provider is a cloud-backed provider and consent is set
- `cloud_consent`: `true` when `AI_CLOUD_CONSENT=true`

## Configuration reference

| Variable | Default | Meaning |
| --- | --- | --- |
| `AI_ENABLED` | `false` | Master switch |
| `AI_FAKE_PROVIDER` | `false` | Offline deterministic provider (tests) |
| `AI_PROVIDER` | `""` | `ollama` / `anthropic` / `groq` / `openai` |
| `AI_CLOUD_CONSENT` | `false` | Required for any cloud provider |
| `AI_API_KEY` | `""` | Provider key (Anthropic / Groq / OpenAI) |
| `AI_MODEL` | `""` | Override provider model |
| `ANTHROPIC_API_KEY` | `""` | Anthropic-specific key |
| `GROQ_API_KEY` | `""` | Groq-specific key |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local inference endpoint |
| `OLLAMA_MODEL` | `llama3.1:8b` | Default Ollama model |
| `AI_DAILY_LIMIT` | `100` | Global rolling-day cap |
