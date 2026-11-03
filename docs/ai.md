# AI — Configuration & Privacy

## 1. Providers

| Provider | When | Env var required |
|---|---|---|
| `ollama` | Local dev, air-gapped | `OLLAMA_HOST` |
| `openrouter` | Dev/staging, cloud | `OPENROUTER_API_KEY` |
| `disabled` | Production (default) | — |

Provider is resolved in this order:
1. **DB row** `AISettings.provider` (set via `/staff/ai-settings`)
2. **Env var** `AI_PROVIDER`
3. **Fallback** `disabled`

> **Note:** DB config takes precedence over `AI_ENABLED`. If a DB row exists with `provider=openrouter`, setting `AI_ENABLED=False` in env alone does NOT disable AI. You must PATCH the row or delete it.

## 2. Cloud consent

`AI_CLOUD_CONSENT` / `AISettings.cloud_consent` must be **true** for any cloud provider to be used. Otherwise the router fails-closed with `AIProviderError`.

## 3. Privacy trade-off — free models

Free models on OpenRouter (e.g. `nvidia/nemotron-3.5-super-vl:free`) require:
- `OPENROUTER_DATA_COLLECTION=allow` — **prompts may be used for training**
- `OPENROUTER_ZDR=false` — **zero data retention disabled**

**This is acceptable only in `dev` / `staging`.** In `.env.production`:

```env
AI_ENABLED=False
AI_CLOUD_CONSENT=False
OPENROUTER_ZDR=true
OPENROUTER_DATA_COLLECTION=deny
```

If production AI is required, switch to a **paid model** and keep `ZDR=true` + `deny`.

## 4. Prompt redaction

Before any prompt leaves the process, `redact_for_cloud()` runs:
- Strips emails, IPs, URLs, tokens (`sk-*`, `ghp_*`, `AKIA*`)
- Caps at 4000 chars
- Logged in `apps/ai_assistant/redaction.py`

**Redaction is not a substitute for consent.** Even redacted prompts must not be sent to providers that train on data.

## 5. Fail-closed behavior

The router (`apps/ai/gateway/router.py`) raises `AIProviderError` when:
- No provider configured
- `cloud_consent=false` for cloud provider
- API key missing
- Provider returns non-2xx

Callers must catch this and degrade gracefully — never fall back to a cloud provider implicitly.

> **Note:** `backend-integration` CI job requires `OPENROUTER_API_KEY` secret; if absent, job is skipped via `continue-on-error: true`, not failed. Set with: `gh secret set OPENROUTER_API_KEY -R Anasshouran/amanak`
## 6. Testing AI features

Env-sensitive tests are marked:
```python
@pytest.mark.integration
@pytest.mark.skipif(not os.getenv("OPENROUTER_API_KEY"), reason="...")
```

Run locally: `pytest -m "not integration"` (no key needed).
CI: `backend-integration` job runs with real key on master only.

## 7. Adding a new provider

1. Implement `BaseProvider` in `apps/ai/providers/`
2. Register in `PROVIDER_REGISTRY` (`apps/ai/gateway/router.py`)
3. Add env vars to `.env.example` (with comments)
4. Document privacy implications in **this file** — section 3
5. Add integration test in `tests/ai/test_provider_<name>.py` (marked `integration`)

## 8. Free tier policy

AI features are **disabled on the free plan** (`plans.py::free.ai_enabled=False`, line 18).
This is enforced by design — no separate failing test exists in the current suite.

**Rationale:**
- Free tier uses a shared OpenRouter key → cost risk + abuse potential
- Re-evaluate for v1.2 with rate-limiting (e.g. 10 calls/month)

To enable for a specific plan: edit `backend/apps/billing/plans.py` → `ai_enabled=True`
